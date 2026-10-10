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
  /**
   * Other host names in the same hosted zone, e.g. `www.example.com`, that
   * permanently redirect to `domainName`, keeping the path and query string.
   */
  redirectDomainNames: string[];
};

export type DeployConfig = {
  stage: Stage;
  /** Without a domain the site is served on CloudFront's default domain. */
  domain?: DomainConfig;
};

/**
 * Reads the deployment from the CDK context (`-c stage=staging|production`)
 * and the environment: DOMAIN_NAME, HOSTED_ZONE_ID, HOSTED_ZONE_NAME (all three
 * or none), and optionally REDIRECT_DOMAIN_NAMES (comma-separated host names
 * that redirect to DOMAIN_NAME). GitHub Actions passes unset variables as
 * empty strings.
 */
export function readDeployConfig(stage: unknown, env: NodeJS.ProcessEnv): DeployConfig {
  if (!isStage(stage)) {
    throw new Error(`Pass the stage to deploy: -c stage=${STAGES.join('|')} (got ${JSON.stringify(stage)}).`);
  }

  const domainName = env.DOMAIN_NAME || undefined;
  const hostedZoneId = env.HOSTED_ZONE_ID || undefined;
  const hostedZoneName = env.HOSTED_ZONE_NAME || undefined;
  const redirectDomainNames = (env.REDIRECT_DOMAIN_NAMES ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  if (domainName && hostedZoneId && hostedZoneName) {
    for (const name of redirectDomainNames) {
      if (name === domainName || !isInZone(name, hostedZoneName)) {
        throw new Error(`REDIRECT_DOMAIN_NAMES: ${name} must be another host name in ${hostedZoneName}.`);
      }
    }
    return { stage, domain: { domainName, hostedZoneId, hostedZoneName, redirectDomainNames } };
  }
  if (domainName || hostedZoneId || hostedZoneName) {
    throw new Error('Set all of DOMAIN_NAME, HOSTED_ZONE_ID and HOSTED_ZONE_NAME, or none of them.');
  }
  if (redirectDomainNames.length > 0) {
    throw new Error('REDIRECT_DOMAIN_NAMES needs DOMAIN_NAME, HOSTED_ZONE_ID and HOSTED_ZONE_NAME.');
  }
  return { stage };
}

function isInZone(name: string, zoneName: string) {
  return name === zoneName || name.endsWith(`.${zoneName}`);
}

function isStage(value: unknown): value is Stage {
  return STAGES.some((stage) => stage === value);
}
