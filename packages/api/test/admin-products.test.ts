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

describe('the new-product form’s errors', () => {
  async function post(json: unknown) {
    const owner = await api.owner();
    // @ts-expect-error The client's types allow only valid bodies; send what a broken or outdated form might.
    return owner.client.api.admin.products.$post({ json }, { headers: owner.headers });
  }

  test('the Japanese text is required for each text, and for a detail as soon as any locale is entered', async () => {
    const product = newProduct('no-japanese');
    const res = await post({
      ...product,
      name: { ja: '  ', zh: '月亮戒指', en: 'Moon Ring' },
      description: { zh: '说明' },
      materials: { ja: '', zh: '', en: '18K gold' },
      dimensions: { ja: '', zh: '', en: '' },
      variants: [{ ...product.variants[0], label: { ja: '', en: 'Size 9' } }],
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'invalid_input',
      fields: [
        { path: 'name.ja', code: 'required' },
        { path: 'description.ja', code: 'required' },
        { path: 'materials.ja', code: 'required' },
        { path: 'variants.0.label.ja', code: 'required' },
      ],
    });
  });

  test('prices and on-hand stock are whole numbers of zero or more', async () => {
    const product = newProduct('bad-numbers');
    const [first] = product.variants;
    const res = await post({
      ...product,
      variants: [
        { ...first, sku: 'a', priceYen: -1, onHandStock: 1.5 },
        { ...first, sku: 'b', priceYen: '24000', onHandStock: null },
        { ...first, sku: 'c', priceYen: 0, onHandStock: 0 },
      ],
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'invalid_input',
      fields: [
        { path: 'variants.0.priceYen', code: 'non_negative_integer' },
        { path: 'variants.0.onHandStock', code: 'non_negative_integer' },
        { path: 'variants.1.priceYen', code: 'non_negative_integer' },
        { path: 'variants.1.onHandStock', code: 'required' },
      ],
    });
  });

  test('a product has at least one variant', async () => {
    const res = await post({ ...newProduct('no-variants'), variants: [] });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_input', fields: [{ path: 'variants', code: 'at_least_one_variant' }] });
  });

  test.each(['Moon-Ring', 'moon ring', 'moon_ring', '-moon', 'moon--ring', 'ムーン', ''])(
    'the slug %j is refused: lowercase letters and digits joined by hyphens only',
    async (slug) => {
      const res = await post({ ...newProduct('x'), slug });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: 'invalid_input',
        fields: [{ path: 'slug', code: slug === '' ? 'required' : 'invalid_slug' }],
      });
    },
  );

  test('a slug another product has is taken', async () => {
    const owner = await api.owner();
    await create(owner, 'taken-ring');

    const res = await post({ ...newProduct('taken-ring'), variants: [{ ...newProduct('other').variants[0] }] });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_input', fields: [{ path: 'slug', code: 'slug_taken' }] });
  });

  test('each SKU is unique across the catalog: within the product and among every other product’s', async () => {
    const owner = await api.owner();
    await create(owner, 'sku-owner');
    const [first, second] = newProduct('sku-thief').variants;

    const res = await post({
      ...newProduct('sku-thief'),
      variants: [
        { ...first, sku: 'sku-owner-11' },
        { ...second, sku: 'twice' },
        { ...second, sku: 'twice' },
      ],
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'invalid_input',
      fields: [
        { path: 'variants.0.sku', code: 'sku_taken' },
        { path: 'variants.2.sku', code: 'sku_taken' },
      ],
    });
    const notCreated = await owner.client.api.admin.products[':slug'].$get({ param: { slug: 'sku-thief' } });
    expect(notCreated.status).toBe(404);
  });

  test('the category must be one of the categories', async () => {
    const res = await post({ ...newProduct('lost-ring'), categorySlug: 'brooch' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_input', fields: [{ path: 'categorySlug', code: 'unknown_category' }] });
  });

  test('a product may be in no category', async () => {
    const owner = await api.owner();

    const res = await owner.client.api.admin.products.$post(
      { json: { ...newProduct('free-ring'), categorySlug: null } },
      { headers: owner.headers },
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ slug: 'free-ring', categorySlug: null });
  });
});

describe('listing, unlisting, archiving and restoring', () => {
  type Change = 'list' | 'unlist' | 'archive' | 'restore';

  function change(owner: Owner, slug: string, action: Change, version: number) {
    return owner.client.api.admin.products[':slug'][action].$post(
      { param: { slug }, json: { version } },
      { headers: owner.headers },
    );
  }

  async function storeSlugs() {
    const res = await api.client().api.products.$get({ query: { locale: 'ja' } });
    assert(res.ok);
    return (await res.json()).products.map((product) => product.slug);
  }

  async function storePage(slug: string) {
    return api.client().api.products[':slug'].$get({ param: { slug }, query: { locale: 'en' } });
  }

  test('listing a draft puts it in the store, with its details in the requested locale', async () => {
    api.clock.set(new Date('2026-10-01T10:00:00+09:00'));
    const owner = await api.owner();
    await create(owner, 'listed-ring');

    const res = await change(owner, 'listed-ring', 'list', 1);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'listed', listedAt: '2026-10-01T01:00:00.000Z', version: 2 });
    expect(await storeSlugs()).toContain('listed-ring');
    const page = await storePage('listed-ring');
    assert(page.ok);
    expect((await page.json()).product).toMatchObject({
      name: '月のリング',
      description: 'A ring shaped like the moon.',
      category: { slug: 'ring', name: 'Rings' },
      variants: [
        { sku: 'listed-ring-9', label: 'Size 9', priceYen: 24_000, stockStatus: 'in_stock' },
        { sku: 'listed-ring-11', label: 'Size 11', priceYen: 25_000, stockStatus: 'sold_out' },
      ],
    });
  });

  test('unlisting takes it out of the store; listing it again keeps when it was first listed', async () => {
    api.clock.set(new Date('2026-10-01T10:00:00+09:00'));
    const owner = await api.owner();
    await create(owner, 'relisted-ring');
    await change(owner, 'relisted-ring', 'list', 1);

    const unlisted = await change(owner, 'relisted-ring', 'unlist', 2);

    expect(unlisted.status).toBe(200);
    expect(await unlisted.json()).toMatchObject({ status: 'draft', version: 3 });
    expect(await storeSlugs()).not.toContain('relisted-ring');
    expect((await storePage('relisted-ring')).status).toBe(404);

    api.clock.set(new Date('2026-10-01T11:00:00+09:00'));
    const relisted = await change(owner, 'relisted-ring', 'list', 3);
    expect(await relisted.json()).toMatchObject({ status: 'listed', listedAt: '2026-10-01T01:00:00.000Z' });
  });

  test.each(['draft', 'listed'] as const)('a %s product can be archived, which takes it out of the store', async (status) => {
    const owner = await api.owner();
    const slug = `archived-${status}`;
    await create(owner, slug);
    if (status === 'listed') await change(owner, slug, 'list', 1);
    const version = status === 'listed' ? 2 : 1;

    const res = await change(owner, slug, 'archive', version);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'archived', version: version + 1 });
    expect(await storeSlugs()).not.toContain(slug);
    expect((await storePage(slug)).status).toBe(404);
  });

  test('restoring an archived product makes it a draft again', async () => {
    const owner = await api.owner();
    await create(owner, 'restored-ring');
    await change(owner, 'restored-ring', 'archive', 1);

    const res = await change(owner, 'restored-ring', 'restore', 2);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'draft', version: 3 });
    expect(await storeSlugs()).not.toContain('restored-ring');
  });

  test.each([
    { from: 'draft', action: 'unlist' },
    { from: 'draft', action: 'restore' },
    { from: 'listed', action: 'list' },
    { from: 'listed', action: 'restore' },
    { from: 'archived', action: 'list' },
    { from: 'archived', action: 'unlist' },
    { from: 'archived', action: 'archive' },
  ] as const)('a $from product cannot be told to $action', async ({ from, action }) => {
    const owner = await api.owner();
    const slug = `${from}-cannot-${action}`;
    await create(owner, slug);
    if (from !== 'draft') await change(owner, slug, from === 'listed' ? 'list' : 'archive', 1);
    const version = from === 'draft' ? 1 : 2;

    const res = await change(owner, slug, action, version);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'invalid_status_transition' });
    const unchanged = await owner.client.api.admin.products[':slug'].$get({ param: { slug } });
    expect(await unchanged.json()).toMatchObject({ status: from, version });
  });

  test('a change made from an outdated version is refused, and changes nothing', async () => {
    const owner = await api.owner();
    await create(owner, 'contested-ring');
    await change(owner, 'contested-ring', 'list', 1);

    const res = await change(owner, 'contested-ring', 'unlist', 1);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'stale_version' });
    expect(await storeSlugs()).toContain('contested-ring');
  });

  test('a product that does not exist is not found', async () => {
    const owner = await api.owner();

    const res = await change(owner, 'no-such-ring', 'list', 1);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});
