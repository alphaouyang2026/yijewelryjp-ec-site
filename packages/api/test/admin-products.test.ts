import { assert, beforeAll, describe, expect, test } from 'vitest';
import { useTestApi } from './support/test-api';

const api = useTestApi();

type Owner = Awaited<ReturnType<typeof api.owner>>;

beforeAll(async () => {
  await api.seed.catalog.categories([
    { slug: 'ring', position: 1, name: { ja: 'リング', en: 'Rings' } },
    { slug: 'necklace', position: 2, name: { ja: 'ネックレス' } },
  ]);
});

/** What the admin's product form sends for a new product; `slug` makes it unique. */
function newProduct(slug: string) {
  return {
    slug,
    name: { ja: '月のリング', zh: '月亮戒指', en: '' },
    description: { ja: '月の満ち欠けをかたどったリング。', zh: '', en: 'A ring shaped like the moon.' },
    materials: { ja: 'K18イエローゴールド', zh: '', en: '18K yellow gold' },
    dimensions: { ja: '幅 2mm', zh: '', en: '' },
    weight: { ja: '', zh: '', en: '' },
    care: { ja: '柔らかい布で拭いてください。', zh: '', en: '' },
    categorySlug: 'ring',
    featured: false,
    variants: [
      { sku: `${slug}-9`, label: { ja: '9号', zh: '', en: 'Size 9' }, priceYen: 24_000, onHandStock: 3 },
      { sku: `${slug}-11`, label: { ja: '11号', zh: '', en: 'Size 11' }, priceYen: 25_000, onHandStock: 0 },
    ],
  };
}

async function create(owner: Owner, slug: string) {
  const res = await owner.client.api.admin.products.$post({ json: newProduct(slug) }, { headers: owner.headers });
  assert(res.status === 201, `Expected the product to be created, got ${res.status}`);
  return res.json();
}

describe('creating a product', () => {
  test('a new product is a draft with what the owner entered; blank translations are not set', async () => {
    const owner = await api.owner();

    const res = await owner.client.api.admin.products.$post({ json: newProduct('moon-ring') }, { headers: owner.headers });

    expect(res.status).toBe(201);
    const created = {
      slug: 'moon-ring',
      status: 'draft',
      name: { ja: '月のリング', zh: '月亮戒指' },
      description: { ja: '月の満ち欠けをかたどったリング。', en: 'A ring shaped like the moon.' },
      materials: { ja: 'K18イエローゴールド', en: '18K yellow gold' },
      dimensions: { ja: '幅 2mm' },
      weight: null,
      care: { ja: '柔らかい布で拭いてください。' },
      categorySlug: 'ring',
      featured: false,
      listedAt: null,
      version: 1,
      variants: [
        { sku: 'moon-ring-9', label: { ja: '9号', en: 'Size 9' }, priceYen: 24_000, onHandStock: 3, reservedStock: 0 },
        { sku: 'moon-ring-11', label: { ja: '11号', en: 'Size 11' }, priceYen: 25_000, onHandStock: 0, reservedStock: 0 },
      ],
    };
    expect(await res.json()).toEqual(created);

    const read = await owner.client.api.admin.products[':slug'].$get({ param: { slug: 'moon-ring' } });
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual(created);
  });

  test('a draft does not appear in the store', async () => {
    const owner = await api.owner();
    await create(owner, 'draft-ring');

    const list = await api.client().api.products.$get({ query: { locale: 'ja' } });
    const detail = await api.client().api.products[':slug'].$get({ param: { slug: 'draft-ring' }, query: { locale: 'ja' } });

    assert(list.ok);
    expect((await list.json()).products.map((product) => product.slug)).not.toContain('draft-ring');
    expect(detail.status).toBe(404);
  });
});
