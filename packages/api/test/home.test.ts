import { expect, test } from 'vitest';
import { useTestApi } from './support/test-api';

const api = useTestApi();

test('home data has no new arrivals and no categories while the catalog is empty', async () => {
  const res = await api.client().api.home.$get();

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ newArrivals: [], categories: [] });
});
