import { assert, beforeAll, expect, test } from 'vitest';
import { useTestApi } from './support/test-api';

const api = useTestApi();

beforeAll(async () => {
  await api.seed.catalog.categories([{ slug: 'ring', position: 1, name: { ja: 'リング', zh: '戒指' } }]);
  await api.seed.catalog.products([
    {
      slug: 'old-listed-ring',
      name: { ja: '定番のリング', zh: '经典戒指' },
      categorySlug: 'ring',
      featured: true,
      variants: [
        { priceYen: 12_000, onHandStock: 3, reservedStock: 1 },
        { priceYen: 13_000, onHandStock: 2 },
      ],
    },
    { slug: 'old-draft-brooch', name: { ja: '準備中のブローチ' }, status: 'draft', variants: [{ priceYen: 8_000, onHandStock: 0 }] },
    { slug: 'old-archived-chain', name: { ja: '終売のチェーン' }, status: 'archived' },
  ]);
});

/** Creates a draft through the admin, as the owner would. */
async function createDraft(slug: string) {
  const owner = await api.owner();
  const res = await owner.client.api.admin.products.$post(
    {
      json: {
        slug,
        name: { ja: slug, zh: '', en: '' },
        description: { ja: '説明', zh: '', en: '' },
        materials: null,
        dimensions: null,
        weight: null,
        care: null,
        categorySlug: null,
        featured: false,
        variants: [{ sku: slug, label: { ja: 'フリー', zh: '', en: '' }, priceYen: 5_000, onHandStock: 1 }],
      },
    },
    { headers: owner.headers },
  );
  assert(res.status === 201);
}

test('the admin lists products in every status, the most recently changed first, named in the owner’s locale', async () => {
  api.clock.set(new Date('2026-10-01T10:00:00+09:00'));
  await createDraft('new-pendant');
  const owner = await api.owner();

  const res = await owner.client.api.admin.products.$get({ query: { locale: 'zh' } });

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    products: [
      {
        slug: 'new-pendant',
        name: 'new-pendant',
        status: 'draft',
        featured: false,
        category: null,
        priceYen: 5_000,
        priceVaries: false,
        onHandStock: 1,
        reservedStock: 0,
      },
      {
        slug: 'old-archived-chain',
        name: '終売のチェーン',
        status: 'archived',
        featured: false,
        category: null,
        priceYen: 10_000,
        priceVaries: false,
        onHandStock: 5,
        reservedStock: 0,
      },
      {
        slug: 'old-draft-brooch',
        name: '準備中のブローチ',
        status: 'draft',
        featured: false,
        category: null,
        priceYen: 8_000,
        priceVaries: false,
        onHandStock: 0,
        reservedStock: 0,
      },
      {
        slug: 'old-listed-ring',
        name: '经典戒指',
        status: 'listed',
        featured: true,
        category: { slug: 'ring', name: '戒指' },
        priceYen: 12_000,
        priceVaries: true,
        onHandStock: 5,
        reservedStock: 1,
      },
    ],
  });
});

test.each([
  { status: 'draft' as const, slugs: ['new-pendant', 'old-draft-brooch'] },
  { status: 'listed' as const, slugs: ['old-listed-ring'] },
  { status: 'archived' as const, slugs: ['old-archived-chain'] },
])('the list can show only $status products', async ({ status, slugs }) => {
  const owner = await api.owner();

  const res = await owner.client.api.admin.products.$get({ query: { locale: 'ja', status } });

  assert(res.status === 200);
  expect((await res.json()).products.map((product) => product.slug)).toEqual(slugs);
});

test('an unknown status is refused', async () => {
  const owner = await api.owner();

  // @ts-expect-error The client's types allow only the statuses; send another, as a hand-written URL would.
  const res = await owner.client.api.admin.products.$get({ query: { locale: 'ja', status: 'deleted' } });

  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: 'invalid_query' });
});
