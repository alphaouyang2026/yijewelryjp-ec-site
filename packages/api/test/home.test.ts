import { expect, test } from 'vitest';
import { useTestApi } from './support/test-api';

const api = useTestApi();

test.each(['ja', 'zh', 'en'] as const)(
  'home data in %s has no new arrivals and no categories while the catalog is empty',
  async (locale) => {
    const res = await api.client().api.home.$get({ query: { locale } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ newArrivals: [], categories: [] });
  },
);

test('home data rejects a locale the site does not support', async () => {
  // @ts-expect-error The client's types allow only supported locales; send another one, as a hand-written URL would.
  const res = await api.client().api.home.$get({ query: { locale: 'fr' } });

  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: 'unsupported_locale', supportedLocales: ['ja', 'zh', 'en'] });
});

test('home data rejects a request without a locale', async () => {
  // @ts-expect-error The client's types require a locale; leave it out, as a hand-written URL could.
  const res = await api.client().api.home.$get();

  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: 'unsupported_locale', supportedLocales: ['ja', 'zh', 'en'] });
});
