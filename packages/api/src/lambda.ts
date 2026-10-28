// AWS Lambda entry point for requests from API Gateway HTTP API (payload format 2.0).
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { handle } from 'hono/aws-lambda';
import { createApp } from './app';
import { s3PhotoStorage } from './catalog/infrastructure/s3-photo-storage';
import { dynamoDbAdapters } from './dynamodb-adapters';
import { adminReturnUrls } from './identity/infrastructure/admin-urls';
import { cognitoAdminIdentity } from './identity/infrastructure/cognito-admin-identity';
import { signedCookies } from './interface/signed-cookies';
import { checkoutReturnUrls } from './ordering/infrastructure/checkout-urls';
import { stripePayments } from './ordering/infrastructure/stripe-payments';
import { readSecretString } from './platform/secrets-manager';
import { systemClock } from './shared-kernel/clock';
import { configuredStoreSettings, shippingRatesFromEnv } from './store/infrastructure/configured-store-settings';

// Set by packages/infra (lib/shop-stack.ts).
const env = requiredEnv(
  'TABLE_NAME',
  'PHOTO_BUCKET',
  'SITE_URL',
  'COGNITO_DOMAIN_URL',
  'COGNITO_USER_POOL_ID',
  'COGNITO_CLIENT_ID',
  'COGNITO_CLIENT_SECRET_ARN',
  'SESSION_SECRET_ARN',
  'STRIPE_SECRET_KEY_ARN',
);

// Secrets are read once, when the Lambda instance starts.
const secrets = new SecretsManagerClient({});
const [clientSecret, sessionSecret, stripeSecretKey] = await Promise.all([
  readSecretString(secrets, env.COGNITO_CLIENT_SECRET_ARN),
  readSecretString(secrets, env.SESSION_SECRET_ARN),
  readSecretString(secrets, env.STRIPE_SECRET_KEY_ARN),
]);

const app = createApp({
  ...dynamoDbAdapters({ client: new DynamoDBClient({}), tableName: env.TABLE_NAME }),
  // Upload forms are signed with the function's own credentials, which may put photos into the bucket.
  photoStorage: s3PhotoStorage({ client: new S3Client({}), bucket: env.PHOTO_BUCKET }),
  clock: systemClock,
  adminIdentity: cognitoAdminIdentity({
    domainUrl: env.COGNITO_DOMAIN_URL,
    userPoolId: env.COGNITO_USER_POOL_ID,
    clientId: env.COGNITO_CLIENT_ID,
    clientSecret,
    returnUrls: adminReturnUrls(env.SITE_URL),
  }),
  signedCookies: signedCookies(sessionSecret),
  // SHIPPING_FEE_YEN and FREE_SHIPPING_THRESHOLD_YEN may set other rates; the stack sets neither.
  storeSettings: configuredStoreSettings(shippingRatesFromEnv(process.env)),
  // The owner puts the account's secret key in the secret: a test key on staging (README).
  payments: stripePayments(stripeSecretKey),
  checkoutUrls: checkoutReturnUrls(env.SITE_URL),
});

export const handler = handle(app);

function requiredEnv<Name extends string>(...names: Name[]): Record<Name, string> {
  const values = {} as Record<Name, string>;
  for (const name of names) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} must be set`);
    values[name] = value;
  }
  return values;
}
