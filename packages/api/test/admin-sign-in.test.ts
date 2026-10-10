import { describe, expect, test } from 'vitest';
import { IDENTITY_ORIGIN } from './support/in-memory-admin-identity';
import { useTestApi } from './support/test-api';

const api = useTestApi({ withTable: false });

const owner = { id: 'owner-1', email: 'owner@yijewelry.test' };

test('an owner signs in at the identity provider and comes back to the admin page they wanted, signed in', async () => {
  const client = api.client();

  const start = await client.api.admin.auth['sign-in'].$get({ query: { locale: 'zh', returnTo: '/zh/admin/orders' } });
  expect(start.status).toBe(302);
  const signInPage = new URL(start.headers.get('location') ?? '');
  expect(signInPage.origin + signInPage.pathname).toBe(`${IDENTITY_ORIGIN}/sign-in`);
  expect(signInPage.searchParams.get('lang')).toBe('zh');

  const code = api.identity.issueCode(owner);
  const state = signInPage.searchParams.get('state') ?? '';
  const callback = await client.api.admin.auth.callback.$get({ query: { code, state } });
  expect(callback.status).toBe(302);
  expect(callback.headers.get('location')).toBe('/zh/admin/orders');

  const session = await client.api.admin.session.$get();
  expect(session.status).toBe(200);
  expect(await session.json()).toEqual({ owner: { email: 'owner@yijewelry.test' }, csrfToken: expect.any(String) });
});

test('the session cookie is HTTP-only, Secure and SameSite=Lax', async () => {
  const callback = await api.signIn(api.client(), owner);

  const sessionCookie = callback.headers.getSetCookie().find((cookie) => cookie.startsWith('__Host-yi_admin_session='));
  expect(sessionCookie).toBeDefined();
  expect(sessionCookie).toMatch(/; HttpOnly/);
  expect(sessionCookie).toMatch(/; Secure/);
  expect(sessionCookie).toMatch(/; SameSite=Lax/);
  expect(sessionCookie).toMatch(/; Path=\//);
});

describe('a sign-in that does not come back as it started gives no session', () => {
  async function startSignIn(client: ReturnType<typeof api.client>) {
    const start = await client.api.admin.auth['sign-in'].$get({ query: { locale: 'ja', returnTo: '/admin' } });
    return new URL(start.headers.get('location') ?? '').searchParams.get('state') ?? '';
  }

  async function expectSignedOut(client: ReturnType<typeof api.client>) {
    expect((await client.api.admin.session.$get()).status).toBe(401);
  }

  test('a callback with another state', async () => {
    const client = api.client();
    await startSignIn(client);

    const res = await client.api.admin.auth.callback.$get({
      query: { code: api.identity.issueCode(owner), state: 'forged-state' },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'sign_in_failed' });
    await expectSignedOut(client);
  });

  test('a callback in a browser that never started signing in', async () => {
    const state = await startSignIn(api.client());
    const otherBrowser = api.client();

    const res = await otherBrowser.api.admin.auth.callback.$get({ query: { code: api.identity.issueCode(owner), state } });

    expect(res.status).toBe(400);
    await expectSignedOut(otherBrowser);
  });

  test('a code the provider did not issue, or one already used', async () => {
    const client = api.client();
    const code = api.identity.issueCode(owner);
    await client.api.admin.auth.callback.$get({ query: { code, state: await startSignIn(client) } });
    const another = api.client();

    const reused = await another.api.admin.auth.callback.$get({ query: { code, state: await startSignIn(another) } });
    const unknown = await another.api.admin.auth.callback.$get({
      query: { code: 'made-up', state: await startSignIn(another) },
    });

    expect(reused.status).toBe(400);
    expect(unknown.status).toBe(400);
    await expectSignedOut(another);
  });

  test('a callback reporting an error from the provider, such as a cancelled sign-in', async () => {
    const client = api.client();
    const state = await startSignIn(client);

    const res = await client.api.admin.auth.callback.$get({ query: { error: 'access_denied', state } });

    expect(res.status).toBe(400);
    await expectSignedOut(client);
  });

  test('a callback more than 10 minutes after the sign-in started', async () => {
    const client = api.client();
    api.clock.set(new Date('2026-10-01T10:00:00+09:00'));
    const state = await startSignIn(client);

    api.clock.set(new Date('2026-10-01T10:10:00+09:00'));
    const res = await client.api.admin.auth.callback.$get({ query: { code: api.identity.issueCode(owner), state } });

    expect(res.status).toBe(400);
    await expectSignedOut(client);
  });
});

test.each(['https://evil.test/admin', '//evil.test/admin', '/\\evil.test', 'admin'])(
  'signing in refuses to come back to %s, which is not a path on this site',
  async (returnTo) => {
    const res = await api.client().api.admin.auth['sign-in'].$get({ query: { locale: 'ja', returnTo } });

    expect(res.status).toBe(400);
    expect(res.headers.get('location')).toBeNull();
  },
);

test('signing in needs a supported locale for the provider’s pages', async () => {
  // @ts-expect-error The client's types allow only supported locales; send another one, as a hand-written URL would.
  const res = await api.client().api.admin.auth['sign-in'].$get({ query: { locale: 'fr', returnTo: '/admin' } });

  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: 'unsupported_locale', supportedLocales: ['ja', 'zh', 'en'] });
});
