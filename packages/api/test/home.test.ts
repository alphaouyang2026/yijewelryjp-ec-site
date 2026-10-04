import { beforeAll, describe, expect, test } from 'vitest';
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

describe('with categories and new arrivals in the catalog', () => {
  const api = useTestApi();

  beforeAll(async () => {
    await api.seed.catalog.categories([
      { slug: 'necklace', position: 2, name: { ja: 'ネックレス', zh: '项链', en: 'Necklaces' } },
      { slug: 'earring', position: 3, name: { ja: 'ピアス', zh: '  ' } },
      { slug: 'ring', position: 1, name: { ja: 'リング', zh: '戒指', en: 'Rings' } },
    ]);
    await api.seed.catalog.newArrivals([
      {
        slug: 'moon-ring',
        listedAt: new Date('2026-09-01T10:00:00+09:00'),
        name: { ja: '月のリング', zh: '月亮戒指', en: 'Moon Ring' },
      },
      {
        slug: 'star-necklace',
        listedAt: new Date('2026-09-05T10:00:00+09:00'),
        name: { ja: '星のネックレス', zh: '星星项链', en: 'Star Necklace' },
      },
      {
        slug: 'pearl-earrings',
        listedAt: new Date('2026-09-03T10:00:00+09:00'),
        name: { ja: 'パールピアス', en: '' },
      },
      {
        slug: 'gold-bangle',
        listedAt: new Date('2026-09-04T10:00:00+09:00'),
        name: { ja: 'ゴールドバングル', zh: '金手镯', en: 'Gold Bangle' },
      },
      {
        slug: 'silver-chain',
        listedAt: new Date('2026-09-02T10:00:00+09:00'),
        name: { ja: 'シルバーチェーン', zh: '银链', en: 'Silver Chain' },
      },
    ]);
  });

  test('home data shows the four newest arrivals, newest first, and every category in the owner’s order', async () => {
    const res = await api.client().api.home.$get({ query: { locale: 'ja' } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      newArrivals: [
        { slug: 'star-necklace', name: '星のネックレス' },
        { slug: 'gold-bangle', name: 'ゴールドバングル' },
        { slug: 'pearl-earrings', name: 'パールピアス' },
        { slug: 'silver-chain', name: 'シルバーチェーン' },
      ],
      categories: [
        { slug: 'ring', name: 'リング' },
        { slug: 'necklace', name: 'ネックレス' },
        { slug: 'earring', name: 'ピアス' },
      ],
    });
  });

  test.each([
    {
      locale: 'zh' as const,
      expected: {
        newArrivals: [
          { slug: 'star-necklace', name: '星星项链' },
          { slug: 'gold-bangle', name: '金手镯' },
          { slug: 'pearl-earrings', name: 'パールピアス' },
          { slug: 'silver-chain', name: '银链' },
        ],
        categories: [
          { slug: 'ring', name: '戒指' },
          { slug: 'necklace', name: '项链' },
          { slug: 'earring', name: 'ピアス' },
        ],
      },
    },
    {
      locale: 'en' as const,
      expected: {
        newArrivals: [
          { slug: 'star-necklace', name: 'Star Necklace' },
          { slug: 'gold-bangle', name: 'Gold Bangle' },
          { slug: 'pearl-earrings', name: 'パールピアス' },
          { slug: 'silver-chain', name: 'Silver Chain' },
        ],
        categories: [
          { slug: 'ring', name: 'Rings' },
          { slug: 'necklace', name: 'Necklaces' },
          { slug: 'earring', name: 'ピアス' },
        ],
      },
    },
  ])('home data in $locale has names in $locale, or in Japanese where that translation is missing or blank', async ({
    locale,
    expected,
  }) => {
    const res = await api.client().api.home.$get({ query: { locale } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expected);
  });
});
