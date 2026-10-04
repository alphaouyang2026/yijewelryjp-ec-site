// Local development server: the API on Node.js, backed by DynamoDB Local.
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { createApp } from './app';
import { systemClock } from './clock';
import { createTable, localDynamoClient, waitForDynamoDbLocal, type Database } from './db';

// packages/web/vite.config.ts proxies /api to this port.
const port = 8787;
const db: Database = {
  client: localDynamoClient(),
  tableName: process.env.TABLE_NAME ?? 'yijewelry-local',
};

const app = new Hono().use(logger()).route('/', createApp({ db, clock: systemClock }));

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
