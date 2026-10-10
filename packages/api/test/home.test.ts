import { assert, beforeAll, describe, expect, test } from 'vitest';
import { useTestApi } from './support/test-api';

const api = useTestApi();

test.each(['ja', 'zh', 'en'] as const)(
  'home data in %s has no featured product, no new arrivals and no categories while the catalog is empty',
  async (locale) => {
    const res = await api.client().api.home.$get({ query: { locale } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ featured: null, newArrivals: [], categories: [] });
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

describe('with categories and products in the catalog', () => {
  const api = useTestApi();

  beforeAll(async () => {
    await api.seed.catalog.categories([
      { slug: 'necklace', position: 2, name: { ja: 'ネックレス', zh: '项链', en: 'Necklaces' } },
      { slug: 'earring', position: 3, name: { ja: 'ピアス', zh: '  ' } },
      { slug: 'ring', position: 1, name: { ja: 'リング', zh: '戒指', en: 'Rings' } },
    ]);
    await api.seed.catalog.products([
      {
        slug: 'moon-ring',
        name: { ja: '月のリング', zh: '月亮戒指', en: 'Moon Ring' },
        listedAt: new Date('2026-09-01T10:00:00+09:00'),
        featured: true,
        description: { ja: '月の満ち欠けをかたどったリング。' },
        materials: { ja: 'K18イエローゴールド' },
        variants: [
          { label: { ja: '9号' }, priceYen: 24_000 },
          { label: { ja: '11号' }, priceYen: 25_000 },
        ],
      },
      {
        slug: 'star-necklace',
        name: { ja: '星のネックレス', zh: '星星项链', en: 'Star Necklace' },
        listedAt: new Date('2026-09-05T10:00:00+09:00'),
        featured: true,
        description: { ja: '星をちりばめたネックレス。', en: 'A necklace scattered with stars.' },
        variants: [{ label: { ja: '40cm', en: '40 cm' }, priceYen: 30_000, onHandStock: 1 }],
      },
      {
        slug: 'pearl-earrings',
        name: { ja: 'パールピアス', en: '' },
        listedAt: new Date('2026-09-03T10:00:00+09:00'),
        variants: [{ priceYen: 18_000, onHandStock: 0 }],
      },
      { slug: 'gold-bangle', name: { ja: 'ゴールドバングル' }, listedAt: new Date('2026-09-04T10:00:00+09:00') },
      { slug: 'silver-chain', name: { ja: 'シルバーチェーン' }, listedAt: new Date('2026-09-02T10:00:00+09:00') },
      { slug: 'draft-brooch', status: 'draft', featured: true },
      {
        slug: 'archived-bangle',
        status: 'archived',
        featured: true,
        listedAt: new Date('2026-09-10T10:00:00+09:00'),
      },
    ]);
  });

  test('home data has the four newest listed products, newest first, and every category in the owner’s order', async () => {
    const res = await api.client().api.home.$get({ query: { locale: 'ja' } });

    assert(res.ok);
    const body = await res.json();
    expect(body.newArrivals).toEqual([
      { slug: 'star-necklace', name: '星のネックレス', priceYen: 30_000, priceVaries: false, stockStatus: 'low_stock' },
      { slug: 'gold-bangle', name: 'ゴールドバングル', priceYen: 10_000, priceVaries: false, stockStatus: 'in_stock' },
      { slug: 'pearl-earrings', name: 'パールピアス', priceYen: 18_000, priceVaries: false, stockStatus: 'sold_out' },
      { slug: 'silver-chain', name: 'シルバーチェーン', priceYen: 10_000, priceVaries: false, stockStatus: 'in_stock' },
    ]);
    expect(body.categories).toEqual([
      { slug: 'ring', name: 'リング' },
      { slug: 'necklace', name: 'ネックレス' },
      { slug: 'earring', name: 'ピアス' },
    ]);
  });

  test('the featured product is the most recently listed one the owner featured, never a draft or archived one', async () => {
    const res = await api.client().api.home.$get({ query: { locale: 'en' } });

    assert(res.ok);
    expect((await res.json()).featured).toEqual({
      slug: 'star-necklace',
      name: 'Star Necklace',
      priceYen: 30_000,
      priceVaries: false,
      stockStatus: 'low_stock',
      description: 'A necklace scattered with stars.',
      materials: null,
      variantLabels: ['40 cm'],
    });
  });

  test.each([
    {
      locale: 'zh' as const,
      newArrivals: ['星星项链', 'ゴールドバングル', 'パールピアス', 'シルバーチェーン'],
      categories: ['戒指', '项链', 'ピアス'],
    },
    {
      locale: 'en' as const,
      newArrivals: ['Star Necklace', 'ゴールドバングル', 'パールピアス', 'シルバーチェーン'],
      categories: ['Rings', 'Necklaces', 'ピアス'],
    },
  ])('home data in $locale has names in $locale, or in Japanese where that translation is missing or blank', async ({
    locale,
    newArrivals,
    categories,
  }) => {
    const res = await api.client().api.home.$get({ query: { locale } });

    assert(res.ok);
    const body = await res.json();
    expect(body.newArrivals.map((product) => product.name)).toEqual(newArrivals);
    expect(body.categories.map((category) => category.name)).toEqual(categories);
  });
});
