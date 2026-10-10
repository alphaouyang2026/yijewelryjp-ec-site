import { assert, beforeAll, describe, expect, test } from 'vitest';
import { useTestApi } from './support/test-api';

const categories = [
  { slug: 'ring', position: 1, name: { ja: 'リング', zh: '戒指', en: 'Rings' } },
  { slug: 'necklace', position: 2, name: { ja: 'ネックレス', zh: '项链', en: 'Necklaces' } },
];
const categoryEntries = [
  { slug: 'ring', name: 'リング' },
  { slug: 'necklace', name: 'ネックレス' },
];

describe('product list', () => {
  const api = useTestApi();

  beforeAll(async () => {
    await api.seed.catalog.categories(categories);
    await api.seed.catalog.products([
      {
        slug: 'moon-ring',
        name: { ja: '月のリング', en: 'Moon Ring' },
        categorySlug: 'ring',
        listedAt: new Date('2026-09-01T10:00:00+09:00'),
        variants: [{ priceYen: 12_000 }],
      },
      {
        slug: 'star-necklace',
        name: { ja: '星のネックレス', en: 'Star Necklace' },
        categorySlug: 'necklace',
        listedAt: new Date('2026-09-05T10:00:00+09:00'),
        variants: [{ priceYen: 30_000, onHandStock: 1 }],
      },
      {
        slug: 'pearl-ring',
        name: { ja: 'パールリング', en: '' },
        categorySlug: 'ring',
        listedAt: new Date('2026-09-03T10:00:00+09:00'),
        variants: [
          { priceYen: 9_000, onHandStock: 0 },
          { priceYen: 8_000, onHandStock: 0 },
        ],
      },
      { slug: 'draft-ring', status: 'draft', categorySlug: 'ring' },
      { slug: 'archived-bangle', status: 'archived', listedAt: new Date('2026-09-10T10:00:00+09:00') },
    ]);
  });

  test('shows listed products only, newest first, with their lowest price and stock status', async () => {
    const res = await api.client().api.products.$get({ query: { locale: 'ja' } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      category: null,
      products: [
        { slug: 'star-necklace', name: '星のネックレス', priceYen: 30_000, priceVaries: false, stockStatus: 'low_stock' },
        { slug: 'pearl-ring', name: 'パールリング', priceYen: 8_000, priceVaries: true, stockStatus: 'sold_out' },
        { slug: 'moon-ring', name: '月のリング', priceYen: 12_000, priceVaries: false, stockStatus: 'in_stock' },
      ],
      categories: categoryEntries,
    });
  });

  test.each([
    { sort: 'newest' as const, slugs: ['star-necklace', 'pearl-ring', 'moon-ring'] },
    { sort: 'price_asc' as const, slugs: ['pearl-ring', 'moon-ring', 'star-necklace'] },
    { sort: 'price_desc' as const, slugs: ['star-necklace', 'moon-ring', 'pearl-ring'] },
  ])('sorted by $sort', async ({ sort, slugs }) => {
    const res = await api.client().api.products.$get({ query: { locale: 'ja', sort } });

    assert(res.ok);
    expect((await res.json()).products.map((product) => product.slug)).toEqual(slugs);
  });

  test("a category's list has its listed products only, and names the category", async () => {
    const res = await api.client().api.products.$get({ query: { locale: 'en', category: 'ring' } });

    assert(res.ok);
    const body = await res.json();
    expect(body.category).toEqual({ slug: 'ring', name: 'Rings' });
    expect(body.products.map((product) => [product.slug, product.name])).toEqual([
      ['pearl-ring', 'パールリング'],
      ['moon-ring', 'Moon Ring'],
    ]);
  });

  test('a category that does not exist is not found', async () => {
    const res = await api.client().api.products.$get({ query: { locale: 'ja', category: 'brooch' } });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  test('an unsupported sort order is rejected', async () => {
    // @ts-expect-error The client's types allow only supported sort orders; send another one, as a hand-written URL would.
    const res = await api.client().api.products.$get({ query: { locale: 'ja', sort: 'popular' } });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_query' });
  });

  test('an unsupported locale is rejected', async () => {
    // @ts-expect-error The client's types allow only supported locales; send another one, as a hand-written URL would.
    const res = await api.client().api.products.$get({ query: { locale: 'fr' } });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'unsupported_locale', supportedLocales: ['ja', 'zh', 'en'] });
  });
});

describe('product detail', () => {
  const api = useTestApi();

  beforeAll(async () => {
    await api.seed.catalog.categories(categories);
    await api.seed.catalog.products([
      {
        slug: 'moon-ring',
        categorySlug: 'ring',
        name: { ja: '月のリング', zh: '月亮戒指' },
        description: { ja: '月の満ち欠けをかたどったリング。', zh: '以月亮盈亏为造型的戒指。' },
        materials: { ja: 'K18イエローゴールド', zh: '' },
        dimensions: { ja: '幅 2mm' },
        weight: { ja: '約1.5g' },
        care: { ja: '使用後は柔らかい布で拭いてください。' },
        variants: [
          { sku: 'moon-ring-7', label: { ja: '7号', zh: '7号' }, priceYen: 24_000, onHandStock: 3 },
          { sku: 'moon-ring-9', label: { ja: '9号', zh: '9号' }, priceYen: 24_000, onHandStock: 2 },
          { sku: 'moon-ring-11', label: { ja: '11号' }, priceYen: 25_000, onHandStock: 3, reservedStock: 2 },
          { sku: 'moon-ring-13', label: { ja: '13号' }, priceYen: 25_000, onHandStock: 2, reservedStock: 2 },
        ],
      },
      {
        slug: 'sold-out-ring',
        variants: [{ onHandStock: 0 }, { onHandStock: 1, reservedStock: 1 }],
      },
      { slug: 'plain-ring' },
      { slug: 'draft-ring', status: 'draft' },
      { slug: 'archived-ring', status: 'archived' },
    ]);
  });

  test('has the product’s details, its category, and each variant with its price and stock status', async () => {
    const res = await api.client().api.products[':slug'].$get({ param: { slug: 'moon-ring' }, query: { locale: 'ja' } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      product: {
        slug: 'moon-ring',
        name: '月のリング',
        description: '月の満ち欠けをかたどったリング。',
        materials: 'K18イエローゴールド',
        dimensions: '幅 2mm',
        weight: '約1.5g',
        care: '使用後は柔らかい布で拭いてください。',
        category: { slug: 'ring', name: 'リング' },
        stockStatus: 'in_stock',
        variants: [
          { sku: 'moon-ring-7', label: '7号', priceYen: 24_000, stockStatus: 'in_stock' },
          { sku: 'moon-ring-9', label: '9号', priceYen: 24_000, stockStatus: 'low_stock' },
          { sku: 'moon-ring-11', label: '11号', priceYen: 25_000, stockStatus: 'low_stock' },
          { sku: 'moon-ring-13', label: '13号', priceYen: 25_000, stockStatus: 'sold_out' },
        ],
      },
      categories: categoryEntries,
    });
  });

  test('a product is sold out when every variant’s stock is on hand but reserved or gone', async () => {
    const res = await api.client().api.products[':slug'].$get({
      param: { slug: 'sold-out-ring' },
      query: { locale: 'ja' },
    });

    assert(res.ok);
    const { product } = await res.json();
    expect(product.stockStatus).toBe('sold_out');
    expect(product.variants.map((variant) => variant.stockStatus)).toEqual(['sold_out', 'sold_out']);
  });

  test('details without a translation, or left blank, are in Japanese', async () => {
    const res = await api.client().api.products[':slug'].$get({ param: { slug: 'moon-ring' }, query: { locale: 'zh' } });

    assert(res.ok);
    const { product } = await res.json();
    expect(product).toMatchObject({
      name: '月亮戒指',
      description: '以月亮盈亏为造型的戒指。',
      materials: 'K18イエローゴールド',
      dimensions: '幅 2mm',
      category: { slug: 'ring', name: '戒指' },
    });
    expect(product.variants.map((variant) => variant.label)).toEqual(['7号', '9号', '11号', '13号']);
  });

  test('details the owner left out are null, and so is a missing category', async () => {
    const res = await api.client().api.products[':slug'].$get({ param: { slug: 'plain-ring' }, query: { locale: 'ja' } });

    assert(res.ok);
    const { product } = await res.json();
    expect(product).toMatchObject({ materials: null, dimensions: null, weight: null, care: null, category: null });
  });

  test.each(['draft-ring', 'archived-ring', 'no-such-ring'])('%s is not found', async (slug) => {
    const res = await api.client().api.products[':slug'].$get({ param: { slug }, query: { locale: 'ja' } });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});
