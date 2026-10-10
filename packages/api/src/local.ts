// Local development server: the API on Node.js, backed by DynamoDB Local.
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { createApp } from './app';
import { dynamoDbAdapters } from './dynamodb-adapters';
import { adminReturnUrls } from './identity/infrastructure/admin-urls';
import { devAdminIdentity } from './identity/infrastructure/dev-admin-identity';
import { signedCookies } from './interface/signed-cookies';
import type { Database } from './platform/dynamodb';
import { createTable, localDynamoClient, waitForDynamoDbLocal } from './platform/dynamodb-local';
import { systemClock } from './shared-kernel/clock';

// packages/web/vite.config.ts proxies /api to this port.
const port = 8787;
const db: Database = {
  client: localDynamoClient(),
  tableName: process.env.TABLE_NAME ?? 'yijewelry-local',
};

// Signing in to the admin needs no Cognito locally: the dev identity signs
// everyone in as this owner at once (README "本地登录后台").
const devOwner = { id: 'local-owner', email: process.env.DEV_OWNER_EMAIL ?? 'owner@localhost' };

const app = new Hono().use(logger()).route(
  '/',
  createApp({
    ...dynamoDbAdapters(db),
    clock: systemClock,
    // Relative URLs: the browser stays on the Vite dev server, which proxies /api here.
    adminIdentity: devAdminIdentity({ owner: devOwner, returnUrls: adminReturnUrls('') }),
    signedCookies: signedCookies(process.env.SESSION_SECRET ?? 'local-development-session-secret'),
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
