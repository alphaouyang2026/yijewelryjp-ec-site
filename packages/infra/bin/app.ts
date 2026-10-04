// The CDK app. Every command needs one of:
//   -c stage=staging|production   the shop (and its certificate stack when a domain is set)
//   -c deployAccess=true          the GitHub deploy role, deployed once by the owner
// See README "部署（AWS）".
import { App, Tags } from 'aws-cdk-lib';
import { CertificateStack } from '../lib/certificate-stack';
import { readDeployConfig } from '../lib/config';
import { DeployAccessStack } from '../lib/deploy-access-stack';
import { ShopStack } from '../lib/shop-stack';

const SHOP_REGION = 'ap-northeast-1';
// CloudFront accepts certificates from this region only.
const CERTIFICATE_REGION = 'us-east-1';
const GITHUB_REPOSITORY = 'alphaouyang2026/yijewelryjp-ec-site';

const app = new App();
const account = process.env.CDK_DEFAULT_ACCOUNT;
Tags.of(app).add('project', 'yijewelryjp-ec-site');

if (app.node.tryGetContext('deployAccess') === 'true') {
  new DeployAccessStack(app, 'YiJewelryDeployAccess', {
    env: { account, region: SHOP_REGION },
    githubRepository: app.node.tryGetContext('githubRepository') ?? GITHUB_REPOSITORY,
    existingOidcProviderArn: app.node.tryGetContext('githubOidcProviderArn'),
  });
} else {
  const config = readDeployConfig(app.node.tryGetContext('stage'), process.env);
  Tags.of(app).add('stage', config.stage);

  const certificateStack = config.domain
    ? new CertificateStack(app, `YiJewelryCertificate-${config.stage}`, {
        env: { account, region: CERTIFICATE_REGION },
        crossRegionReferences: true,
        domain: config.domain,
      })
    : undefined;

  new ShopStack(app, `YiJewelry-${config.stage}`, {
    env: { account, region: SHOP_REGION },
    crossRegionReferences: Boolean(certificateStack),
    config,
    certificate: certificateStack?.certificate,
  });
}
