import { randomUUID } from 'node:crypto';
import { CreateTableCommand, DeleteTableCommand } from '@aws-sdk/client-dynamodb';
import { hc } from 'hono/client';
import { CookieJar } from 'tough-cookie';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { createApp, type AppType } from '../../src/app';
import { localDynamoClient, tableDefinition } from '../../src/db';
import { createTestClock } from './test-clock';

// Requests never leave the process; the origin only gives cookies a domain to live on.
const ORIGIN = 'https://shop.test';

// Every test starts at this instant unless it sets the clock itself.
const DEFAULT_NOW = new Date('2026-01-01T00:00:00+09:00');

/**
 * Builds the API with test adapters for the enclosing test file (or describe
 * block): a fresh DynamoDB Local table, created before its tests and deleted
 * after, and a clock the tests control.
 */
export function useTestApi({ createTable = true }: { createTable?: boolean } = {}) {
  const db = { client: localDynamoClient(), tableName: `test-${randomUUID()}` };
  const clock = createTestClock(DEFAULT_NOW);
  const app = createApp({ db, clock });

  beforeAll(async () => {
    if (createTable) await db.client.send(new CreateTableCommand(tableDefinition(db.tableName)));
  });

  afterAll(async () => {
    if (createTable) await db.client.send(new DeleteTableCommand({ TableName: db.tableName }));
    db.client.destroy();
  });

  beforeEach(() => {
    clock.set(DEFAULT_NOW);
  });

  return {
    clock,
    /** A new client with its own cookie jar, like a fresh browser. */
    client() {
      return hc<AppType>(ORIGIN, { fetch: fetchWithCookies(app, new CookieJar()) });
    },
  };
}

function fetchWithCookies(app: AppType, jar: CookieJar): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    const cookie = await jar.getCookieString(request.url);
    if (cookie) request.headers.set('cookie', cookie);

    const response = await app.request(request);

    for (const setCookie of response.headers.getSetCookie()) {
      await jar.setCookie(setCookie, request.url);
    }
    return response;
  };
}
