import { randomUUID } from 'node:crypto';
import { S3Client } from '@aws-sdk/client-s3';
import { Hono } from 'hono';
import { hc } from 'hono/client';
import { setCookie } from 'hono/cookie';
import { CookieJar } from 'tough-cookie';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import * as z from 'zod';
import { createApp, type AppDeps } from '../../src/app';
import { s3PhotoStorage } from '../../src/catalog/infrastructure/s3-photo-storage';
import { dynamoDbAdapters } from '../../src/dynamodb-adapters';
import { signedCookies, type SignedCookies } from '../../src/interface/signed-cookies';
import { createTable, deleteTable, localDynamoClient } from '../../src/platform/dynamodb-local';
import { catalogSeed } from './catalog-seed';
import type { Owner } from '../../src/identity/domain/owner';
import { createInMemoryAdminIdentity } from './in-memory-admin-identity';
import { createTestClock } from './test-clock';

// Requests never leave the process; the origin only gives cookies a domain to live on.
const ORIGIN = 'https://shop.test';

const TEST_COOKIE_SECRET = 'test-cookie-secret';

/**
 * The bucket test upload forms are for. Signing a form is computed locally,
 * so tests use the production adapter with made-up credentials; nothing is
 * uploaded, and the bucket need not exist.
 */
export const TEST_PHOTO_BUCKET = 'yijewelry-test-photos';
export const TEST_PHOTO_CREDENTIALS = { accessKeyId: 'test-access-key', secretAccessKey: 'test-secret-key' };

// Every test starts at this instant unless it sets the clock itself.
const DEFAULT_NOW = new Date('2026-01-01T00:00:00+09:00');

/**
 * Routes that exist only in tests, under /api/_test. POST /cookie sets a
 * cookie and GET /cookie answers with the Cookie header the request carried,
 * so tests can check the test client itself. POST /session-cookie sets the
 * session cookie to the JSON body, signed with the session cookie's key
 * whatever its shape, as only someone with the signing secret could.
 */
function testOnlyRoutes(cookies: SignedCookies) {
  const anySessionCookie = cookies.cookie('yi_admin_session', z.unknown());
  return new Hono()
    .post('/cookie', (c) => {
      setCookie(c, 'probe', 'set-by-api');
      return c.body(null, 204);
    })
    .get('/cookie', (c) => c.json({ cookie: c.req.header('cookie') ?? null }, 200))
    .post('/session-cookie', async (c) => {
      await anySessionCookie.write(c, await c.req.json(), 60);
      return c.body(null, 204);
    });
}

function createTestApp(deps: AppDeps) {
  return createApp(deps).route('/_test', testOnlyRoutes(deps.signedCookies));
}

type TestApp = ReturnType<typeof createTestApp>;

/**
 * Builds the API the way its entry points do, with test adapters, for the
 * enclosing test file (or describe block): the DynamoDB adapters on a fresh
 * DynamoDB Local table, created before its tests and deleted after, and a
 * clock the tests control, an in-memory identity provider owners sign in
 * with, and S3 upload forms for a test bucket. The test-only routes are mounted too, and `seed`
 * puts data the API cannot create yet into the table.
 */
export function useTestApi({ withTable = true }: { withTable?: boolean } = {}) {
  const db = { client: localDynamoClient(), tableName: `test-${randomUUID()}` };
  const clock = createTestClock(DEFAULT_NOW);
  const adminIdentity = createInMemoryAdminIdentity();
  const app = createTestApp({
    ...dynamoDbAdapters(db),
    photoStorage: s3PhotoStorage({
      client: new S3Client({ region: 'ap-northeast-1', credentials: TEST_PHOTO_CREDENTIALS }),
      bucket: TEST_PHOTO_BUCKET,
    }),
    clock,
    adminIdentity,
    signedCookies: signedCookies(TEST_COOKIE_SECRET),
  });

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
    /**
     * A new client signed in as an owner, and the headers its data-changing
     * admin requests send: the session's CSRF token, as the admin sends it.
     */
    async owner() {
      const ownerClient = client();
      await this.signIn(ownerClient);
      const session = await ownerClient.api.admin.session.$get();
      if (session.status !== 200) throw new Error(`Expected a session, got ${session.status}`);
      const headers = { 'X-CSRF-Token': (await session.json()).csrfToken };
      return { client: ownerClient, headers };
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
