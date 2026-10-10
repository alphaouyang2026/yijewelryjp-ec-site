import { Stack, type StackProps } from 'aws-cdk-lib';
import { Certificate, CertificateValidation, type ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';
import type { DomainConfig } from './config';

type CertificateStackProps = StackProps & { domain: DomainConfig };

/**
 * The TLS certificate for the site's custom domain. CloudFront only accepts
 * certificates from us-east-1, so this stack is deployed there; the shop stack
 * in Tokyo references it across regions.
 */
export class CertificateStack extends Stack {
  readonly certificate: ICertificate;

  constructor(scope: Construct, id: string, { domain, ...props }: CertificateStackProps) {
    super(scope, id, props);

    const zone = HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: domain.hostedZoneId,
      zoneName: domain.hostedZoneName,
    });

    this.certificate = new Certificate(this, 'Certificate', {
      domainName: domain.domainName,
      // The redirecting host names need TLS too, before CloudFront can redirect them.
      subjectAlternativeNames: domain.redirectDomainNames.length > 0 ? domain.redirectDomainNames : undefined,
      validation: CertificateValidation.fromDns(zone),
    });
  }
}
