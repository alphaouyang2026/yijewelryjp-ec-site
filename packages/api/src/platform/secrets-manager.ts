import { GetSecretValueCommand, type SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

/** The text of the secret `secretId` (its ARN or name) in AWS Secrets Manager. */
export async function readSecretString(client: SecretsManagerClient, secretId: string): Promise<string> {
  const { SecretString } = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!SecretString) throw new Error(`Secret ${secretId} has no text value`);
  return SecretString;
}
