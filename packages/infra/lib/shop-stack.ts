import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import {
  AllowedMethods,
  CacheCookieBehavior,
  CachedMethods,
  CacheHeaderBehavior,
  CachePolicy,
  CacheQueryStringBehavior,
  Distribution,
  Function as CloudFrontFunction,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
  HttpVersion,
  OriginProtocolPolicy,
  OriginRequestPolicy,
  PriceClass,
  ResponseHeadersPolicy,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
  type BehaviorOptions,
} from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import {
  AccountRecovery,
  CfnManagedLoginBranding,
  FeaturePlan,
  ManagedLoginVersion,
  Mfa,
  OAuthScope,
  UserPool,
  UserPoolClientIdentityProvider,
} from 'aws-cdk-lib/aws-cognito';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { AaaaRecord, ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';
import type { DeployConfig } from './config';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const apiEntry = fileURLToPath(new URL('../../api/src/lambda.ts', import.meta.url));
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));

/** Hashed files never change under their name, so browsers and CloudFront keep them for a year. */
const HASHED_FILE_CACHE = 'public, max-age=31536000, immutable';

/** CloudFront Function statements: rewrite every page path to the React app's HTML shell. */
const SERVE_HTML_SHELL_FOR_PAGES = `
  var lastSegment = request.uri.split('/').pop();
  // A path whose last segment has a file extension is a file in the bucket;
  // every other path (/, /products, /zh/cart, ...) is a page the React app routes.
  if (!/\\.[A-Za-z0-9]+$/.test(lastSegment)) {
    request.uri = '/index.html';
  }`;

/**
 * The source of a viewer-request CloudFront Function. With `redirect`, a
 * request for one of its host names gets a 301 to the same path and query on
 * `canonicalHost`; any other request runs `statements` (which may change
 * `request`) and goes on.
 */
function viewerRequestFunction(redirect: { canonicalHost: string; hosts: string[] } | undefined, statements = '') {
  const redirectCheck = redirect
    ? `
  var host = request.headers.host ? request.headers.host.value : '';
  if (${JSON.stringify(redirect.hosts)}.indexOf(host) !== -1) {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: 'https://${redirect.canonicalHost}' + request.uri + queryString(request.querystring) } },
    };
  }`
    : '';
  const queryStringHelper = redirect
    ? `

// The query string as the viewer sent it, repeated keys included.
function queryString(querystring) {
  var parts = [];
  Object.keys(querystring).forEach(function (key) {
    var entry = querystring[key];
    (entry.multiValue || [entry]).forEach(function (item) {
      parts.push(item.value === '' ? key : key + '=' + item.value);
    });
  });
  return parts.length > 0 ? '?' + parts.join('&') : '';
}`
    : '';
  return `
function handler(event) {
  var request = event.request;${redirectCheck}${statements}
  return request;
}${queryStringHelper}`;
}

type ShopStackProps = StackProps & {
  config: DeployConfig;
  /** From the certificate stack (us-east-1); required when the config has a domain. */
  certificate?: ICertificate;
};

/**
 * One stage of the shop: the API on Lambda behind API Gateway HTTP API, the
 * single DynamoDB table, the bucket with the React build and product images,
 * the CloudFront distribution that serves all of them on one domain, and the
 * Cognito user pool owners sign in to the admin with.
 */
export class ShopStack extends Stack {
  constructor(scope: Construct, id: string, { config, certificate, ...props }: ShopStackProps) {
    super(scope, id, props);

    if (config.domain && !certificate) throw new Error('A custom domain needs the certificate stack.');

    const isProduction = config.stage === 'production';
    // Production data and files outlive the stack; staging's can be thrown away.
    const removalPolicy = isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    // --- Data ----------------------------------------------------------------

    // Same shape as the DynamoDB Local table (createTable in
    // packages/api/src/platform/dynamodb-local.ts).
    const table = new Table(this, 'Table', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: isProduction,
      removalPolicy,
    });

    // The React build under assets/ and index.html at the root, and product
    // images under images/. Only CloudFront reads it.
    const bucket = new Bucket(this, 'SiteBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy,
      autoDeleteObjects: !isProduction,
    });

    // --- API -----------------------------------------------------------------

    const api = new NodejsFunction(this, 'Api', {
      description: `Y&I Jewelry API (${config.stage})`,
      entry: apiEntry,
      handler: 'handler',
      projectRoot: repoRoot,
      depsLockFilePath: join(repoRoot, 'package-lock.json'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(10),
      environment: {
        TABLE_NAME: table.tableName,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        format: OutputFormat.ESM,
        target: 'node24',
        sourceMap: true,
        mainFields: ['module', 'main'],
        // Lets CommonJS dependencies bundled into the ES module call require().
        banner: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
      },
      logGroup: new LogGroup(this, 'ApiLogs', {
        retention: isProduction ? RetentionDays.THREE_MONTHS : RetentionDays.ONE_MONTH,
        removalPolicy,
      }),
    });
    // Read/write includes dynamodb:DescribeTable, which the health check uses.
    table.grantReadWriteData(api);

    const httpApi = new HttpApi(this, 'HttpApi', {
      description: `Y&I Jewelry API (${config.stage})`,
      defaultIntegration: new HttpLambdaIntegration('ApiIntegration', api),
    });
    const apiDomain = `${httpApi.apiId}.execute-api.${this.region}.${this.urlSuffix}`;

    // --- CloudFront ----------------------------------------------------------

    const siteOrigin = S3BucketOrigin.withOriginAccessControl(bucket);

    // index.html is uploaded with `no-cache`, so CloudFront revalidates it on
    // every request and a deploy takes effect at once.
    const pagesCachePolicy = new CachePolicy(this, 'PagesCachePolicy', {
      comment: 'Y&I pages: cached only as the file in the bucket allows',
      minTtl: Duration.seconds(0),
      defaultTtl: Duration.seconds(0),
      maxTtl: Duration.days(365),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // The API decides what may be cached and for how long through
    // Cache-Control (packages/api/src/interface/cache-control.ts): public
    // catalog data for about a minute, everything else never. Responses that
    // depend on cookies (cart, admin) are always no-store, so cookies need not
    // be part of the cache key; the query string is (it carries the locale).
    const apiCachePolicy = new CachePolicy(this, 'ApiCachePolicy', {
      comment: 'Y&I API: cached only as its Cache-Control allows',
      minTtl: Duration.seconds(0),
      defaultTtl: Duration.seconds(0),
      maxTtl: Duration.minutes(5),
      queryStringBehavior: CacheQueryStringBehavior.all(),
      headerBehavior: CacheHeaderBehavior.none(),
      cookieBehavior: CacheCookieBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // Requests for a redirecting host name (e.g. www.) get a 301 to the site's
    // domain before anything else, on every behavior.
    const redirect =
      config.domain && config.domain.redirectDomainNames.length > 0
        ? { canonicalHost: config.domain.domainName, hosts: config.domain.redirectDomainNames }
        : undefined;

    const pageRouting = new CloudFrontFunction(this, 'PageRouting', {
      comment: 'Y&I: serve the React HTML shell for every page path',
      runtime: FunctionRuntime.JS_2_0,
      code: FunctionCode.fromInline(viewerRequestFunction(redirect, SERVE_HTML_SHELL_FOR_PAGES)),
    });

    const hostRedirect = redirect
      ? new CloudFrontFunction(this, 'HostRedirect', {
          comment: `Y&I: redirect ${redirect.hosts.join(', ')} to ${redirect.canonicalHost}`,
          runtime: FunctionRuntime.JS_2_0,
          code: FunctionCode.fromInline(viewerRequestFunction(redirect)),
        })
      : undefined;
    const hostRedirectAssociations = hostRedirect
      ? [{ function: hostRedirect, eventType: FunctionEventType.VIEWER_REQUEST }]
      : undefined;

    const fileBehavior: BehaviorOptions = {
      origin: siteOrigin,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: CachePolicy.CACHING_OPTIMIZED,
      responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS,
      functionAssociations: hostRedirectAssociations,
    };

    const distribution = new Distribution(this, 'Distribution', {
      comment: `Y&I Jewelry (${config.stage})`,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: siteOrigin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: pagesCachePolicy,
        responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [{ function: pageRouting, eventType: FunctionEventType.VIEWER_REQUEST }],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new HttpOrigin(apiDomain, { protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY }),
          viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachedMethods: CachedMethods.CACHE_GET_HEAD,
          cachePolicy: apiCachePolicy,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS,
          functionAssociations: hostRedirectAssociations,
        },
        // Vite's hashed build output.
        '/assets/*': fileBehavior,
        // Product images (uploaded by the admin, under immutable keys).
        '/images/*': fileBehavior,
      },
      domainNames: config.domain ? [config.domain.domainName, ...config.domain.redirectDomainNames] : undefined,
      certificate,
      // Includes edge locations in Japan and the rest of Asia, at lower cost than all locations.
      priceClass: PriceClass.PRICE_CLASS_200,
      httpVersion: HttpVersion.HTTP2_AND_3,
      // Only a custom certificate can raise the minimum; CloudFront's default certificate is fixed.
      minimumProtocolVersion: certificate ? SecurityPolicyProtocol.TLS_V1_2_2021 : undefined,
    });

    // --- Frontend upload -----------------------------------------------------

    if (!existsSync(join(webDist, 'index.html'))) {
      throw new Error(`The frontend build is missing at ${webDist}. Run \`npm run build\` first.`);
    }
    const site = Source.asset(webDist);

    // Hashed files first, so a new HTML shell never points at files that are
    // not there yet. Old hashed files stay (prune: false) for pages that are
    // still open; images uploaded by the admin are never touched.
    const hashedFiles = new BucketDeployment(this, 'DeployHashedFiles', {
      sources: [site],
      destinationBucket: bucket,
      exclude: ['*'],
      include: ['assets/*'],
      prune: false,
      cacheControl: [CacheControl.fromString(HASHED_FILE_CACHE)],
      memoryLimit: 512,
    });

    const htmlShell = new BucketDeployment(this, 'DeployHtmlShell', {
      sources: [site],
      destinationBucket: bucket,
      exclude: ['assets/*'],
      prune: false,
      cacheControl: [CacheControl.noCache()],
      distribution,
      // Every page path is rewritten to /index.html, so this one path covers them all.
      distributionPaths: ['/index.html'],
      memoryLimit: 512,
    });
    htmlShell.node.addDependency(hashedFiles);

    // --- Custom domain -------------------------------------------------------

    if (config.domain) {
      const zone = HostedZone.fromHostedZoneAttributes(this, 'Zone', {
        hostedZoneId: config.domain.hostedZoneId,
        zoneName: config.domain.hostedZoneName,
      });
      const target = RecordTarget.fromAlias(new CloudFrontTarget(distribution));
      new ARecord(this, 'SiteAliasIpv4', { zone, recordName: config.domain.domainName, target });
      new AaaaRecord(this, 'SiteAliasIpv6', { zone, recordName: config.domain.domainName, target });
      // The redirecting host names reach the same distribution, which redirects them.
      for (const name of config.domain.redirectDomainNames) {
        new ARecord(this, `RedirectAliasIpv4-${name}`, { zone, recordName: name, target });
        new AaaaRecord(this, `RedirectAliasIpv6-${name}`, { zone, recordName: name, target });
      }
    }

    // --- Owner sign-in (Cognito) ----------------------------------------------

    // The site's own URL, where Cognito sends the browser back to. With a
    // custom domain it is a plain string. Without one it is the distribution's
    // default domain, known only once CloudFormation creates the distribution;
    // that does not form a cycle, because nothing the distribution depends on
    // (the HTTP API and the bucket) depends on the Lambda function or the user
    // pool: the order is HTTP API -> distribution -> app client -> secret ->
    // the function's environment and policy, with the integration (HTTP API ->
    // function) created last. CloudFormation creates the app client once the
    // distribution exists.
    const siteUrl = `https://${config.domain?.domainName ?? distribution.distributionDomainName}`;

    // Owner accounts only: no self sign-up (the owner creates accounts, see
    // README), email as the user name, and a TOTP app as the required second
    // factor. The Essentials plan (free up to 10,000 monthly active users)
    // is what managed login and its Japanese and Chinese pages need.
    const ownerPool = new UserPool(this, 'OwnerPool', {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      mfa: Mfa.REQUIRED,
      mfaSecondFactor: { otp: true, sms: false, email: false },
      passwordPolicy: { minLength: 12, tempPasswordValidity: Duration.days(3) },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      featurePlan: FeaturePlan.ESSENTIALS,
      // Production keeps the owners' accounts (and their TOTP set-up).
      deletionProtection: isProduction,
      removalPolicy,
    });

    // Cognito's managed login pages, on a prefix of amazoncognito.com. The
    // prefix must be unique across all of AWS; the stage and account make it so.
    const managedLogin = ownerPool.addDomain('ManagedLogin', {
      cognitoDomain: { domainPrefix: `yijewelry-${config.stage}-${this.account}` },
      managedLoginVersion: ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    });

    // The API is a confidential client: it alone exchanges authorization codes
    // (with the client secret) at the token endpoint, on its callback route.
    // These URLs must match packages/api/src/identity/infrastructure/admin-urls.ts.
    const adminClient = ownerPool.addClient('AdminClient', {
      generateSecret: true,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [OAuthScope.OPENID, OAuthScope.EMAIL],
        callbackUrls: [`${siteUrl}/api/admin/auth/callback`],
        // After signing out, the store's home page in the admin's locale.
        logoutUrls: [`${siteUrl}/`, `${siteUrl}/zh/`, `${siteUrl}/en/`],
      },
      supportedIdentityProviders: [UserPoolClientIdentityProvider.COGNITO],
      preventUserExistenceErrors: true,
      // The API reads the ID token once, at the callback, and keeps no tokens;
      // the admin session (2 hours idle, 12 hours at most) is its own cookie.
      idTokenValidity: Duration.minutes(5),
      accessTokenValidity: Duration.minutes(5),
      refreshTokenValidity: Duration.hours(1),
    });

    // Managed login shows a client's pages only once it has a style; this is Cognito's default look.
    new CfnManagedLoginBranding(this, 'ManagedLoginStyle', {
      userPoolId: ownerPool.userPoolId,
      clientId: adminClient.userPoolClientId,
      useCognitoProvidedValues: true,
    });

    // Secrets the API reads when a Lambda instance starts: the app client's
    // secret (copied from Cognito) and the key that signs the owner's session
    // cookie (generated here; replacing it signs every owner out).
    const adminClientSecret = new Secret(this, 'AdminClientSecret', {
      description: `Y&I Jewelry (${config.stage}): the Cognito app client secret the API signs owners in with`,
      secretStringValue: adminClient.userPoolClientSecret,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const sessionSecret = new Secret(this, 'SessionSecret', {
      description: `Y&I Jewelry (${config.stage}): the key that signs the admin session cookie`,
      generateSecretString: { passwordLength: 64, excludePunctuation: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Reading the two secrets is all the function needs: exchanging codes and
    // fetching the user pool's signing keys are public HTTPS endpoints.
    adminClientSecret.grantRead(api);
    sessionSecret.grantRead(api);
    api.addEnvironment('SITE_URL', siteUrl);
    api.addEnvironment('COGNITO_DOMAIN_URL', managedLogin.baseUrl());
    api.addEnvironment('COGNITO_USER_POOL_ID', ownerPool.userPoolId);
    api.addEnvironment('COGNITO_CLIENT_ID', adminClient.userPoolClientId);
    api.addEnvironment('COGNITO_CLIENT_SECRET_ARN', adminClientSecret.secretArn);
    api.addEnvironment('SESSION_SECRET_ARN', sessionSecret.secretArn);

    new CfnOutput(this, 'SiteUrl', { value: siteUrl });
    new CfnOutput(this, 'AdminUrl', { value: `${siteUrl}/admin` });
    new CfnOutput(this, 'OwnerUserPoolId', { value: ownerPool.userPoolId });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'TableName', { value: table.tableName });
  }
}
