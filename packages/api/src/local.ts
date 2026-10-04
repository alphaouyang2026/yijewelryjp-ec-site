// Local development server: the API on Node.js, backed by DynamoDB Local.
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { createApp } from './app';
import { systemClock } from './clock';
import { createTable, localDynamoClient, type Database } from './db';

// packages/web/vite.config.ts proxies /api to this port.
const port = 8787;
const db: Database = {
  client: localDynamoClient(),
  tableName: process.env.TABLE_NAME ?? 'yijewelry-local',
};

const server = new Hono().use(logger()).route('/', createApp({ db, clock: systemClock }));

serve({ fetch: server.fetch, port, hostname: '127.0.0.1' }, (info) => {
  console.log(`API listening on http://127.0.0.1:${info.port}`);
});

void ensureTable(db);

/** Creates the table in DynamoDB Local, retrying while the container is still starting. */
async function ensureTable(db: Database) {
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      await createTable(db);
      console.log(`Table ${db.tableName} is ready in DynamoDB Local`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  console.warn(`DynamoDB Local is not reachable; /api/health will report unavailable. Start it with \`npm run db:start\`.`);
}
