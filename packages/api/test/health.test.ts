import { describe, expect, test } from 'vitest';
import { useTestApi } from './support/test-api';

describe('with its database table in place', () => {
  const api = useTestApi();

  test('health check reports ok with the current server time', async () => {
    api.clock.set(new Date('2026-10-04T09:30:00+09:00'));

    const res = await api.client().api.health.$get();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', time: '2026-10-04T00:30:00.000Z' });
  });
});

describe('without its database table', () => {
  const api = useTestApi({ withTable: false });

  test('health check reports the API as unavailable', async () => {
    const res = await api.client().api.health.$get();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'unavailable' });
  });
});
