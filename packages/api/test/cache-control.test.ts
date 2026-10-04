import { expect, test } from 'vitest';
import { useTestApi } from './support/test-api';

// CloudFront caches /api/* responses only as their Cache-Control header allows (#6).

const api = useTestApi();

test('home data may be cached for about a minute, then served stale while it refreshes', async () => {
  const res = await api.client().api.home.$get({ query: { locale: 'ja' } });

  expect(res.status).toBe(200);
  expect(res.headers.get('cache-control')).toBe('public, max-age=60, stale-while-revalidate=30');
});

test('a home data request the API rejects is not cached', async () => {
  // @ts-expect-error The client's types allow only supported locales; send another one, as a hand-written URL would.
  const res = await api.client().api.home.$get({ query: { locale: 'fr' } });

  expect(res.status).toBe(400);
  expect(res.headers.get('cache-control')).toBe('no-store');
});

test('the health check is not cached', async () => {
  const res = await api.client().api.health.$get();

  expect(res.headers.get('cache-control')).toBe('no-store');
});

test('a route that does not allow caching is not cached', async () => {
  // A test-only route stands in for the cart, checkout, order, admin and webhook routes to come.
  const res = await api.client().api._test.cookie.$get();

  expect(res.status).toBe(200);
  expect(res.headers.get('cache-control')).toBe('no-store');
});
