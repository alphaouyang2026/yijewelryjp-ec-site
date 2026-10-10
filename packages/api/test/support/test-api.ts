import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { hc } from 'hono/client';
import { setCookie } from 'hono/cookie';
import { CookieJar } from 'tough-cookie';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { createApp, type AppDeps } from '../../src/app';
import { dynamoDbAdapters } from '../../src/dynamodb-adapters';
import { createTable, deleteTable, localDynamoClient } from '../../src/platform/dynamodb-local';
import { catalogSeed } from './catalog-seed';
import type { Owner } from '../../src/identity/domain/owner';
import { createInMemoryAdminIdentity } from './in-memory-admin-identity';
import { createTestClock } from './test-clock';

// Requests never leave the process; the origin only gives cookies a domain to live on.
const ORIGIN = 'https://shop.test';

const TEST_SESSION_SECRET = 'test-session-secret';

// Every test starts at this instant unless it sets the clock itself.
const DEFAULT_NOW = new Date('2026-01-01T00:00:00+09:00');

/**
 * Routes that exist only in tests, under /api/_test, so tests can check the
 * test client itself. POST sets a cookie; GET answers with the Cookie header
 * the request carried.
 */
const testOnlyRoutes = new Hono()
  .post('/cookie', (c) => {
    setCookie(c, 'probe', 'set-by-api');
    return c.body(null, 204);
  })
  .get('/cookie', (c) => c.json({ cookie: c.req.header('cookie') ?? null }, 200));

function createTestApp(deps: AppDeps) {
  return createApp(deps).route('/_test', testOnlyRoutes);
}

type TestApp = ReturnType<typeof createTestApp>;

/**
 * Builds the API the way its entry points do, with test adapters, for the
 * enclosing test file (or describe block): the DynamoDB adapters on a fresh
 * DynamoDB Local table, created before its tests and deleted after, and a
 * clock the tests control, and an in-memory identity provider owners sign in
 * with. The test-only routes are mounted too, and `seed`
 * puts data the API cannot create yet into the table.
 */
export function useTestApi({ withTable = true }: { withTable?: boolean } = {}) {
  const db = { client: localDynamoClient(), tableName: `test-${randomUUID()}` };
  const clock = createTestClock(DEFAULT_NOW);
  const adminIdentity = createInMemoryAdminIdentity();
  const app = createTestApp({ ...dynamoDbAdapters(db), clock, adminIdentity, sessionSecret: TEST_SESSION_SECRET });

  beforeAll(async () => {
    if (withTable) await createTable(db);
  });

  afterAll(async () => {
    if (withTable) await deleteTable(db);
    db.client.destroy();
  });

  beforeEach(() => {
    clock.set(DEFAULT_NOW);
  });

  return {
    clock,
    seed: { catalog: catalogSeed(db) },
    /** The identity provider owners sign in with. */
    identity: adminIdentity,
    /** A new client with its own cookie jar, like a fresh browser. */
    client,
    /** Every route the API has (method and path, once each), for tests that walk a group of routes. */
    routes: [...new Set(app.routes.map(({ method, path }) => `${method} ${path}`))].map((route) => {
      const [method = '', path = ''] = route.split(' ');
      return { method, path };
    }),
    /** A request to `path` with no cookies other than those in `init`, for routes the typed client cannot name. */
    request(path: string, init?: RequestInit) {
      return app.request(`${ORIGIN}${path}`, init);
    },
    /**
     * Signs `owner` in on `client`, as a browser goes through the admin's
     * sign-in: from the API's sign-in route to the provider, then back to the
     * API's callback with the provider's code. Returns the callback's response.
     */
    async signIn(client: TestClient, owner: Owner = DEFAULT_OWNER) {
      const start = await client.api.admin.auth['sign-in'].$get({ query: { locale: 'ja', returnTo: '/admin' } });
      const state = new URL(start.headers.get('location') ?? '').searchParams.get('state') ?? '';
      const code = adminIdentity.issueCode(owner);
      return client.api.admin.auth.callback.$get({ query: { code, state } });
    },
  };

  function client() {
    return hc<TestApp>(ORIGIN, { fetch: fetchWithCookies(app, new CookieJar()) });
  }
}

type TestClient = ReturnType<typeof hc<TestApp>>;

const DEFAULT_OWNER: Owner = { id: 'owner-1', email: 'owner@yijewelry.test' };

function fetchWithCookies(app: TestApp, jar: CookieJar): typeof fetch {
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
