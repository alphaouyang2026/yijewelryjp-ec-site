import { assert, beforeAll, describe, expect, test } from 'vitest';
import { useTestApi } from './support/test-api';

type Owner = Awaited<ReturnType<ReturnType<typeof useTestApi>['owner']>>;

/** The categories the store's navigation lists, in order, named in `locale`. */
async function storeCategories(api: ReturnType<typeof useTestApi>, locale: 'ja' | 'en' = 'ja') {
  const res = await api.client().api.home.$get({ query: { locale } });
  assert(res.ok);
  return (await res.json()).categories;
}

function createCategory(owner: Owner, json: { slug: string; name: { ja: string; zh: string; en: string } }) {
  return owner.client.api.admin.categories.$post({ json }, { headers: owner.headers });
}

async function adminCategories(owner: Owner) {
  const res = await owner.client.api.admin.categories.$get({ query: { locale: 'en' } });
  assert(res.status === 200);
  return (await res.json()).categories;
}

describe('creating and renaming categories', () => {
  const api = useTestApi();

  beforeAll(async () => {
    await api.seed.catalog.categories([{ slug: 'ring', position: 1, name: { ja: 'リング', en: 'Rings' } }]);
  });

  test('a new category comes after the others, in the admin and in the store', async () => {
    const owner = await api.owner();

    const res = await createCategory(owner, { slug: 'necklace', name: { ja: 'ネックレス', zh: '', en: 'Necklaces' } });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      slug: 'necklace',
      name: { ja: 'ネックレス', en: 'Necklaces' },
      version: 1,
    });
    expect(await adminCategories(owner)).toEqual([
      { slug: 'ring', displayName: 'Rings', name: { ja: 'リング', en: 'Rings' }, version: 1 },
      { slug: 'necklace', displayName: 'Necklaces', name: { ja: 'ネックレス', en: 'Necklaces' }, version: 1 },
    ]);
    expect(await storeCategories(api, 'en')).toEqual([
      { slug: 'ring', name: 'Rings' },
      { slug: 'necklace', name: 'Necklaces' },
    ]);
  });

  test('a category needs its Japanese name and a free slug of lowercase letters, digits and hyphens', async () => {
    const owner = await api.owner();

    const noJapanese = await createCategory(owner, { slug: 'bracelet', name: { ja: ' ', zh: '手链', en: '' } });
    const badSlug = await createCategory(owner, { slug: 'Bracelet', name: { ja: 'ブレスレット', zh: '', en: '' } });
    const taken = await createCategory(owner, { slug: 'ring', name: { ja: '指輪', zh: '', en: '' } });

    expect(noJapanese.status).toBe(400);
    expect(await noJapanese.json()).toEqual({ error: 'invalid_input', fields: [{ path: 'name.ja', code: 'required' }] });
    expect(await badSlug.json()).toEqual({ error: 'invalid_input', fields: [{ path: 'slug', code: 'invalid_slug' }] });
    expect(await taken.json()).toEqual({ error: 'invalid_input', fields: [{ path: 'slug', code: 'slug_taken' }] });
    expect((await storeCategories(api)).map((category) => category.slug)).not.toContain('bracelet');
  });

  test('renaming a category shows in the store; its slug stays', async () => {
    const owner = await api.owner();
    await createCategory(owner, { slug: 'earring', name: { ja: 'ピアス', zh: '', en: '' } });

    const res = await owner.client.api.admin.categories[':slug'].$put(
      { param: { slug: 'earring' }, json: { name: { ja: 'イヤリング', zh: '耳饰', en: 'Earrings' }, version: 1 } },
      { headers: owner.headers },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      slug: 'earring',
      name: { ja: 'イヤリング', zh: '耳饰', en: 'Earrings' },
      version: 2,
    });
    expect(await storeCategories(api, 'en')).toContainEqual({ slug: 'earring', name: 'Earrings' });
  });

  test('a rename needs the Japanese name, and is refused when made from an outdated version', async () => {
    const owner = await api.owner();
    await createCategory(owner, { slug: 'anklet', name: { ja: 'アンクレット', zh: '', en: '' } });
    const rename = (name: { ja: string; zh: string; en: string }, version: number) =>
      owner.client.api.admin.categories[':slug'].$put(
        { param: { slug: 'anklet' }, json: { name, version } },
        { headers: owner.headers },
      );

    const blank = await rename({ ja: '', zh: '', en: 'Anklets' }, 1);
    await rename({ ja: '足首飾り', zh: '', en: '' }, 1);
    const stale = await rename({ ja: 'アンクレット', zh: '', en: '' }, 1);

    expect(await blank.json()).toEqual({ error: 'invalid_input', fields: [{ path: 'name.ja', code: 'required' }] });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ error: 'stale_version' });
    expect(await storeCategories(api)).toContainEqual({ slug: 'anklet', name: '足首飾り' });
  });

  test('a category that does not exist is not found', async () => {
    const owner = await api.owner();

    const res = await owner.client.api.admin.categories[':slug'].$put(
      { param: { slug: 'brooch' }, json: { name: { ja: 'ブローチ', zh: '', en: '' }, version: 1 } },
      { headers: owner.headers },
    );

    expect(res.status).toBe(404);
  });
});

describe('ordering categories', () => {
  const api = useTestApi();

  beforeAll(async () => {
    await api.seed.catalog.categories([
      { slug: 'ring', position: 1, name: { ja: 'リング' } },
      { slug: 'necklace', position: 2, name: { ja: 'ネックレス' } },
      { slug: 'earring', position: 3, name: { ja: 'ピアス' } },
    ]);
  });

  function reorder(owner: Owner, categories: { slug: string; version: number }[]) {
    return owner.client.api.admin['category-order'].$put(
      { query: { locale: 'ja' }, json: { categories } },
      { headers: owner.headers },
    );
  }

  test('the owner’s order is the order of the store’s navigation and category list', async () => {
    const owner = await api.owner();

    const res = await reorder(owner, [
      { slug: 'earring', version: 1 },
      { slug: 'ring', version: 1 },
      { slug: 'necklace', version: 1 },
    ]);

    expect(res.status).toBe(200);
    expect((await storeCategories(api)).map((category) => category.slug)).toEqual(['earring', 'ring', 'necklace']);
    const list = await api.client().api.products.$get({ query: { locale: 'ja' } });
    assert(list.ok);
    expect((await list.json()).categories.map((category) => category.slug)).toEqual(['earring', 'ring', 'necklace']);
    expect(await res.json()).toEqual({
      categories: [
        { slug: 'earring', displayName: 'ピアス', name: { ja: 'ピアス' }, version: 2 },
        { slug: 'ring', displayName: 'リング', name: { ja: 'リング' }, version: 2 },
        { slug: 'necklace', displayName: 'ネックレス', name: { ja: 'ネックレス' }, version: 2 },
      ],
    });
  });

  test('an order made from outdated categories is refused, and the order stays', async () => {
    const owner = await api.owner();
    const before = await adminCategories(owner);
    const current = before.map(({ slug, version }) => ({ slug, version }));

    const outdated = await reorder(owner, [{ ...current[2]!, version: 1 }, current[0]!, current[1]!]);
    const missingOne = await reorder(owner, [current[1]!, current[0]!]);

    expect(outdated.status).toBe(409);
    expect(await outdated.json()).toEqual({ error: 'stale_version' });
    expect(missingOne.status).toBe(409);
    expect(await adminCategories(owner)).toEqual(before);
  });

  test('a category may not appear twice in the order', async () => {
    const owner = await api.owner();
    const current = (await adminCategories(owner)).map(({ slug, version }) => ({ slug, version }));

    const res = await reorder(owner, [current[0]!, current[0]!, current[1]!, current[2]!]);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_input', fields: [{ path: 'categories', code: 'invalid' }] });
  });
});
