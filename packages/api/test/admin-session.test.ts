import { describe, expect, test } from 'vitest';
import { useTestApi } from './support/test-api';

const api = useTestApi({ withTable: false });

test('the admin session is refused to a visitor who has not signed in', async () => {
  const res = await api.client().api.admin.session.$get();

  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ error: 'unauthorized' });
});

describe('session expiry', () => {
  const signedInAt = new Date('2026-10-01T10:00:00+09:00');
  const minutesLater = (minutes: number) => new Date(signedInAt.getTime() + minutes * 60_000);

  // The test client keeps cookies by real time, so the expired session's
  // cookie still goes to the API: the API itself refuses it.
  test('the session ends after 2 hours without an admin request', async () => {
    const client = api.client();
    api.clock.set(signedInAt);
    await api.signIn(client);

    api.clock.set(minutesLater(120));
    const res = await client.api.admin.session.$get();

    expect(res.status).toBe(401);
  });

  test('each admin request keeps the session for another 2 hours', async () => {
    const client = api.client();
    api.clock.set(signedInAt);
    await api.signIn(client);

    api.clock.set(minutesLater(119));
    expect((await client.api.admin.session.$get()).status).toBe(200);
    api.clock.set(minutesLater(238));
    expect((await client.api.admin.session.$get()).status).toBe(200);
    api.clock.set(minutesLater(358));
    expect((await client.api.admin.session.$get()).status).toBe(401);
  });

  // So an owner disabled at the identity provider loses access within 12
  // hours even while active: signing in again asks the provider.
  test('the session ends 12 hours after signing in, however active the owner is', async () => {
    const client = api.client();
    api.clock.set(signedInAt);
    await api.signIn(client);

    for (let minutes = 100; minutes < 12 * 60; minutes += 100) {
      api.clock.set(minutesLater(minutes));
      expect((await client.api.admin.session.$get()).status).toBe(200);
    }
    api.clock.set(minutesLater(12 * 60 - 1));
    expect((await client.api.admin.session.$get()).status).toBe(200);
    api.clock.set(minutesLater(12 * 60));
    expect((await client.api.admin.session.$get()).status).toBe(401);
  });

  test('signing in again starts a new 12 hours', async () => {
    const client = api.client();
    api.clock.set(signedInAt);
    await api.signIn(client);

    api.clock.set(minutesLater(12 * 60));
    expect((await client.api.admin.session.$get()).status).toBe(401);
    await api.signIn(client);
    api.clock.set(minutesLater(12 * 60 + 100));
    expect((await client.api.admin.session.$get()).status).toBe(200);
  });
});
