// Local development server: the API on Node.js, backed by DynamoDB Local, and
// a stand-in for the photo bucket.
import { S3Client } from '@aws-sdk/client-s3';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { createApp } from './app';
import { s3PhotoStorage } from './catalog/infrastructure/s3-photo-storage';
import { dynamoDbAdapters } from './dynamodb-adapters';
import { adminReturnUrls } from './identity/infrastructure/admin-urls';
import { devAdminIdentity } from './identity/infrastructure/dev-admin-identity';
import { signedCookies } from './interface/signed-cookies';
import { LOCAL_PHOTO_BUCKET, LOCAL_PHOTO_CREDENTIALS, localPhotoBucket } from './local-photo-bucket';
import type { Database } from './platform/dynamodb';
import { createTable, localDynamoClient, waitForDynamoDbLocal } from './platform/dynamodb-local';
import { systemClock } from './shared-kernel/clock';
import { configuredStoreSettings, shippingRatesFromEnv } from './store/infrastructure/configured-store-settings';

// packages/web/vite.config.ts proxies /api to this port.
const port = 8787;
const db: Database = {
  client: localDynamoClient(),
  tableName: process.env.TABLE_NAME ?? 'yijewelry-local',
};

// Signing in to the admin needs no Cognito locally: the dev identity signs
// everyone in as this owner at once (README "本地登录后台").
const devOwner = { id: 'local-owner', email: process.env.DEV_OWNER_EMAIL ?? 'owner@localhost' };

// Upload forms are signed as for S3, but post to the photo bucket's stand-in
// (served below, at /local-s3/*) through the Vite dev server, which proxies
// /local-s3 and /images here, so the admin uploads and shows photos on its own origin.
const photoClient = new S3Client({
  region: 'ap-northeast-1',
  credentials: LOCAL_PHOTO_CREDENTIALS,
  endpoint: 'http://localhost:5173/local-s3',
  forcePathStyle: true,
});

const app = new Hono().use(logger()).route('/', localPhotoBucket()).route(
  '/',
  createApp({
    ...dynamoDbAdapters(db),
    photoStorage: s3PhotoStorage({ client: photoClient, bucket: LOCAL_PHOTO_BUCKET }),
    clock: systemClock,
    // Relative URLs: the browser stays on the Vite dev server, which proxies /api here.
    adminIdentity: devAdminIdentity({ owner: devOwner, returnUrls: adminReturnUrls('') }),
    signedCookies: signedCookies(process.env.SESSION_SECRET ?? 'local-development-session-secret'),
    storeSettings: configuredStoreSettings(shippingRatesFromEnv(process.env)),
  }),
);

serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, (info) => {
  console.log(`API listening on http://127.0.0.1:${info.port}`);
});

void ensureTable(db);

/** Creates the table once DynamoDB Local answers; until then /api/health reports unavailable. */
async function ensureTable(db: Database) {
  try {
    await waitForDynamoDbLocal();
    await createTable(db);
    console.log(`Table ${db.tableName} is ready in DynamoDB Local`);
  } catch (error) {
    console.warn('/api/health will report unavailable:', error instanceof Error ? error.message : error);
  }
}
