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
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { AaaaRecord, ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';
import type { DeployConfig } from './config';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const apiEntry = fileURLToPath(new URL('../../api/src/lambda.ts', import.meta.url));
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));

/** Hashed files never change under their name, so browsers and CloudFront keep them for a year. */
const HASHED_FILE_CACHE = 'public, max-age=31536000, immutable';

type ShopStackProps = StackProps & {
  config: DeployConfig;
  /** From the certificate stack (us-east-1); required when the config has a domain. */
  certificate?: ICertificate;
};

/**
 * One stage of the shop: the API on Lambda behind API Gateway HTTP API, the
 * single DynamoDB table, the bucket with the React build and product images,
 * and the CloudFront distribution that serves all of them on one domain.
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

    const pageRouting = new CloudFrontFunction(this, 'PageRouting', {
      comment: 'Y&I: serve the React HTML shell for every page path',
      runtime: FunctionRuntime.JS_2_0,
      code: FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var lastSegment = request.uri.split('/').pop();
  // A path whose last segment has a file extension is a file in the bucket;
  // every other path (/, /products, /zh/cart, ...) is a page the React app routes.
  if (!/\\.[A-Za-z0-9]+$/.test(lastSegment)) {
    request.uri = '/index.html';
  }
  return request;
}`),
    });

    const fileBehavior: BehaviorOptions = {
      origin: siteOrigin,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: CachePolicy.CACHING_OPTIMIZED,
      responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS,
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
        },
        // Vite's hashed build output.
        '/assets/*': fileBehavior,
        // Product images (uploaded by the admin, under immutable keys).
        '/images/*': fileBehavior,
      },
      domainNames: config.domain ? [config.domain.domainName] : undefined,
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
    }

    new CfnOutput(this, 'SiteUrl', {
      value: `https://${config.domain?.domainName ?? distribution.distributionDomainName}`,
    });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'TableName', { value: table.tableName });
  }
}
