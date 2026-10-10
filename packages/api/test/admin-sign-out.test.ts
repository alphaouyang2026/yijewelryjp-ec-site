import { expect, test } from 'vitest';
import { IDENTITY_ORIGIN } from './support/in-memory-admin-identity';
import { useTestApi } from './support/test-api';

const api = useTestApi({ withTable: false });

type Client = ReturnType<typeof api.client>;

/** The CSRF token the admin gets with its session. */
async function csrfTokenOf(client: Client) {
  const res = await client.api.admin.session.$get();
  if (res.status !== 200) throw new Error(`Expected a session, got ${res.status}`);
  return (await res.json()).csrfToken;
}

async function signedInClient() {
  const client = api.client();
  await api.signIn(client);
  return client;
}

test('an owner signs out: the session ends, and the browser is sent on to sign out at the identity provider', async () => {
  const client = await signedInClient();

  const res = await client.api.admin['sign-out'].$post(
    { query: { locale: 'en' } },
    { headers: { 'X-CSRF-Token': await csrfTokenOf(client) } },
  );

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ signOutUrl: `${IDENTITY_ORIGIN}/sign-out?lang=en` });
  expect((await client.api.admin.session.$get()).status).toBe(401);
});

test('signing out without the CSRF token is refused, and the session goes on', async () => {
  const client = await signedInClient();

  const res = await client.api.admin['sign-out'].$post({ query: { locale: 'ja' } });

  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({ error: 'invalid_csrf_token' });
  expect((await client.api.admin.session.$get()).status).toBe(200);
});

test('signing out with another session’s CSRF token is refused', async () => {
  const client = await signedInClient();
  const otherSessionToken = await csrfTokenOf(await signedInClient());

  const res = await client.api.admin['sign-out'].$post(
    { query: { locale: 'ja' } },
    { headers: { 'X-CSRF-Token': otherSessionToken } },
  );

  expect(res.status).toBe(403);
  expect((await client.api.admin.session.$get()).status).toBe(200);
});

test('each session has its own CSRF token, which stays the same for the session', async () => {
  const client = await signedInClient();

  const first = await csrfTokenOf(client);
  const again = await csrfTokenOf(client);
  const other = await csrfTokenOf(await signedInClient());

  expect(again).toBe(first);
  expect(other).not.toBe(first);
});
