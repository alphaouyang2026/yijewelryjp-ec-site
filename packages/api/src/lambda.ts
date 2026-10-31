// AWS Lambda entry point for requests from API Gateway HTTP API (payload format 2.0).
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { SESv2Client } from '@aws-sdk/client-sesv2';
import { handle } from 'hono/aws-lambda';
import { createApp } from './app';
import { s3PhotoStorage } from './catalog/infrastructure/s3-photo-storage';
import { dynamoDbAdapters } from './dynamodb-adapters';
import { adminReturnUrls } from './identity/infrastructure/admin-urls';
import { cognitoAdminIdentity } from './identity/infrastructure/cognito-admin-identity';
import { signedCookies } from './interface/signed-cookies';
import { consoleMailer } from './ordering/infrastructure/console-mailer';
import { orderPageUrls } from './ordering/infrastructure/order-page-urls';
import { sesMailer } from './ordering/infrastructure/ses-mailer';
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
  'STRIPE_WEBHOOK_SECRET_ARN',
);

// Secrets are read once, when the Lambda instance starts.
const secrets = new SecretsManagerClient({});
const [clientSecret, sessionSecret, stripeSecretKey, stripeWebhookSecret] = await Promise.all([
  readSecretString(secrets, env.COGNITO_CLIENT_SECRET_ARN),
  readSecretString(secrets, env.SESSION_SECRET_ARN),
  readSecretString(secrets, env.STRIPE_SECRET_KEY_ARN),
  readSecretString(secrets, env.STRIPE_WEBHOOK_SECRET_ARN),
]);

// The notices' address; the stack sets it from the stage's OWNER_NOTIFICATION_EMAIL, if any.
const ownerNotificationEmail = process.env.OWNER_NOTIFICATION_EMAIL || undefined;

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
  storeSettings: configuredStoreSettings({
    shippingRates: shippingRatesFromEnv(process.env),
    ownerNotificationEmail,
  }),
  // The owner puts the account's secret key and the webhook's signing secret in the secrets: test mode on staging (README).
  payments: stripePayments(stripeSecretKey, stripeWebhookSecret),
  orderPageUrls: orderPageUrls(env.SITE_URL),
  // MAIL_FROM is set when the stage has a domain, whose SES identity the stack creates; without one, nothing can be sent.
  mailer: process.env.MAIL_FROM
    ? sesMailer(new SESv2Client({}), { from: process.env.MAIL_FROM, replyTo: ownerNotificationEmail })
    : consoleMailer(),
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
