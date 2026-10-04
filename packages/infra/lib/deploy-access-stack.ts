import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import { OidcProviderNative, PolicyStatement, Role, WebIdentityPrincipal } from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';
import { STAGES } from './config';

const GITHUB_OIDC_ISSUER = 'token.actions.githubusercontent.com';

type DeployAccessStackProps = StackProps & {
  /** `owner/name` of the GitHub repository whose workflows may deploy. */
  githubRepository: string;
  /** The account's GitHub OIDC provider, if it already has one (an account can have only one per issuer). */
  existingOidcProviderArn?: string;
};

/**
 * What lets GitHub Actions deploy without long-lived AWS keys: the GitHub OIDC
 * provider and a role that only this repository's `staging` and `production`
 * environments can assume. The role can do nothing but assume the CDK
 * bootstrap roles, which do the actual deploying.
 *
 * Deployed once per account by the shop owner with their own credentials
 * (`-c deployAccess=true`, see README); never by the deploy workflow.
 */
export class DeployAccessStack extends Stack {
  constructor(scope: Construct, id: string, { githubRepository, existingOidcProviderArn, ...props }: DeployAccessStackProps) {
    super(scope, id, props);

    const provider = existingOidcProviderArn
      ? OidcProviderNative.fromOidcProviderArn(this, 'GitHubOidc', existingOidcProviderArn)
      : new OidcProviderNative(this, 'GitHubOidc', {
          url: `https://${GITHUB_OIDC_ISSUER}`,
          clientIds: ['sts.amazonaws.com'],
        });

    const role = new Role(this, 'GitHubDeployRole', {
      description: `Deploys ${githubRepository} from GitHub Actions`,
      maxSessionDuration: Duration.hours(1),
      assumedBy: new WebIdentityPrincipal(provider.oidcProviderArn, {
        StringEquals: { [`${GITHUB_OIDC_ISSUER}:aud`]: 'sts.amazonaws.com' },
        StringLike: {
          [`${GITHUB_OIDC_ISSUER}:sub`]: STAGES.map((stage) => `repo:${githubRepository}:environment:${stage}`),
        },
      }),
    });

    // The CDK bootstrap roles (default qualifier) in every region; IAM role ARNs carry no region.
    role.addToPolicy(
      new PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [`arn:${this.partition}:iam::${this.account}:role/cdk-hnb659fds-*`],
      }),
    );

    new CfnOutput(this, 'DeployRoleArn', {
      value: role.roleArn,
      description: 'Set as AWS_DEPLOY_ROLE_ARN in the GitHub environments staging and production',
    });
  }
}
