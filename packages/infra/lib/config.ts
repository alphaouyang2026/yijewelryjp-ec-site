// What differs between deployments of the same code: the stage, and the
// optional custom domain. Read once in bin/app.ts and passed to the stacks.

export const STAGES = ['staging', 'production'] as const;
export type Stage = (typeof STAGES)[number];

/** A custom domain for the site, in a Route 53 hosted zone of the same account. */
export type DomainConfig = {
  /** The site's host name, e.g. `shop.example.com` or `example.com`. */
  domainName: string;
  hostedZoneId: string;
  /** The hosted zone's name, e.g. `example.com`. */
  hostedZoneName: string;
};

export type DeployConfig = {
  stage: Stage;
  /** Without a domain the site is served on CloudFront's default domain. */
  domain?: DomainConfig;
};

/**
 * Reads the deployment from the CDK context (`-c stage=staging|production`)
 * and the environment (DOMAIN_NAME, HOSTED_ZONE_ID, HOSTED_ZONE_NAME — all
 * three or none; GitHub Actions passes unset variables as empty strings).
 */
export function readDeployConfig(stage: unknown, env: NodeJS.ProcessEnv): DeployConfig {
  if (!isStage(stage)) {
    throw new Error(`Pass the stage to deploy: -c stage=${STAGES.join('|')} (got ${JSON.stringify(stage)}).`);
  }

  const domainName = env.DOMAIN_NAME || undefined;
  const hostedZoneId = env.HOSTED_ZONE_ID || undefined;
  const hostedZoneName = env.HOSTED_ZONE_NAME || undefined;

  if (domainName && hostedZoneId && hostedZoneName) {
    return { stage, domain: { domainName, hostedZoneId, hostedZoneName } };
  }
  if (domainName || hostedZoneId || hostedZoneName) {
    throw new Error('Set all of DOMAIN_NAME, HOSTED_ZONE_ID and HOSTED_ZONE_NAME, or none of them.');
  }
  return { stage };
}

function isStage(value: unknown): value is Stage {
  return STAGES.some((stage) => stage === value);
}
