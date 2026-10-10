import { beforeAll, describe, expect, test } from 'vitest';
import { useTestApi } from './support/test-api';

// The guard on the admin route group applies these rules to every admin route,
// including routes later tickets add; these tests walk the whole route table,
// so a new admin route is checked without anyone adding it here.

const api = useTestApi({ withTable: false });

/** The sign-in routes are the only admin routes open to everyone: they are how an owner signs in. */
const SIGN_IN_ROUTES = /^\/api\/admin\/auth\//;

/** Each admin route as a method and a path to request, its parameters filled in. */
const adminRoutes = api.routes
  .filter(({ method, path }) => method !== 'ALL' && path.startsWith('/api/admin/') && !SIGN_IN_ROUTES.test(path))
  .map(({ method, path }) => ({ method, path: path.replaceAll(/:[^/]+/g, 'x') }));

const stateChangingRoutes = adminRoutes.filter(({ method }) => !['GET', 'HEAD', 'OPTIONS'].includes(method));

test('the walk finds the admin routes, including at least one that changes data', () => {
  expect(adminRoutes).toContainEqual({ method: 'GET', path: '/api/admin/session' });
  expect(stateChangingRoutes).toContainEqual({ method: 'POST', path: '/api/admin/sign-out' });
});

test.each(adminRoutes)('$method $path answers 401 to a visitor who has not signed in', async ({ method, path }) => {
  const res = await api.request(path, { method });

  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ error: 'unauthorized' });
});

describe('for a signed-in owner', () => {
  let sessionCookie = '';
  beforeAll(async () => {
    const client = api.client();
    await api.signIn(client);
    sessionCookie = (await (await client.api._test.cookie.$get()).json()).cookie ?? '';
  });

  test.each(stateChangingRoutes)(
    '$method $path answers 403 without the session’s CSRF token',
    async ({ method, path }) => {
      const missing = await api.request(path, { method, headers: { cookie: sessionCookie } });
      const wrong = await api.request(path, {
        method,
        headers: { cookie: sessionCookie, 'X-CSRF-Token': 'not-the-token' },
      });

      expect(missing.status).toBe(403);
      expect(wrong.status).toBe(403);
      expect(await missing.json()).toEqual({ error: 'invalid_csrf_token' });
    },
  );
});
