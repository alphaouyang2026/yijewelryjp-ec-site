import { screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import type { ProductList } from '../../../api';
import { mockApi } from '../../../test/api-mocks';
import { linkHrefs, linkTexts } from '../../../test/queries';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';

const categories = [
  { slug: 'rings', name: 'リング' },
  { slug: 'earrings', name: 'ピアス' },
];

const allProducts: ProductList = {
  category: null,
  categories,
  products: [
    { slug: 'crescent-ring', name: '三日月のリング', priceYen: 24_000, priceVaries: true, stockStatus: 'in_stock' },
    { slug: 'starlight-necklace', name: '星明かりのネックレス', priceYen: 32_000, priceVaries: false, stockStatus: 'low_stock' },
    { slug: 'pearl-earrings', name: 'パールピアス', priceYen: 28_000, priceVaries: false, stockStatus: 'sold_out' },
  ],
};

test('/products lists every product, newest first, with prices, stock and sort options', async () => {
  server.use(mockApi.productList(allProducts));

  renderRoute('/products');

  const main = await screen.findByRole('main');
  expect(within(main).getByRole('heading', { level: 1, name: 'すべての商品' })).toBeInTheDocument();

  const items = within(main).getAllByRole('listitem');
  expect(items.map((item) => within(item).getByRole('heading').textContent)).toEqual([
    '三日月のリング',
    '星明かりのネックレス',
    'パールピアス',
  ]);
  expect(within(items[0]!).getByRole('link')).toHaveAttribute('href', '/products/crescent-ring');
  // Prices differ between the ring's sizes: the lowest one, marked as a starting price.
  expect(within(items[0]!).getByText('¥24,000〜')).toBeInTheDocument();
  expect(within(items[1]!).getByText('残りわずか')).toBeInTheDocument();
  expect(within(items[2]!).getByText('SOLD OUT')).toBeInTheDocument();

  const sort = within(main).getByRole('navigation', { name: '並び替え' });
  expect(linkTexts(sort)).toEqual(['新着順', '価格の安い順', '価格の高い順']);
  expect(linkHrefs(sort)).toEqual(['/products', '/products?sort=price_asc', '/products?sort=price_desc']);
  expect(within(sort).getByRole('link', { name: '新着順' })).toHaveAttribute('aria-current', 'page');
});

test("a category's page asks the API for that category in the URL's sort order, and is titled with its name", async () => {
  const requests: URL[] = [];
  server.use(
    mockApi.productList(
      { ...allProducts, category: { slug: 'rings', name: 'リング' }, products: allProducts.products.slice(0, 1) },
      requests,
    ),
  );

  renderRoute('/categories/rings?sort=price_desc');

  const main = await screen.findByRole('main');
  expect(within(main).getByRole('heading', { level: 1, name: 'リング' })).toBeInTheDocument();
  expect(Object.fromEntries(requests[0]!.searchParams)).toEqual({ locale: 'ja', category: 'rings', sort: 'price_desc' });
  const sort = within(main).getByRole('navigation', { name: '並び替え' });
  expect(within(sort).getByRole('link', { name: '価格の高い順' })).toHaveAttribute('aria-current', 'page');
  expect(linkHrefs(sort)).toEqual([
    '/categories/rings',
    '/categories/rings?sort=price_asc',
    '/categories/rings?sort=price_desc',
  ]);
});

test('a list without products says so', async () => {
  server.use(mockApi.productList({ ...allProducts, products: [] }));

  renderRoute('/products');

  expect(await screen.findByText('この条件に合う商品はまだありません。')).toBeInTheDocument();
});

test('a category the API does not know shows the not-found page', async () => {
  server.use(mockApi.productList(null));

  renderRoute('/categories/brooches');

  expect(await screen.findByRole('heading', { level: 1, name: 'ページが見つかりません' })).toBeInTheDocument();
});

test('in English, prices and links are in English', async () => {
  const requests: URL[] = [];
  server.use(mockApi.productList(allProducts, requests));

  renderRoute('/en/products');

  const main = await screen.findByRole('main');
  expect(within(main).getByRole('heading', { level: 1, name: 'All products' })).toBeInTheDocument();
  const [first] = within(main).getAllByRole('listitem');
  expect(within(first!).getByRole('link')).toHaveAttribute('href', '/en/products/crescent-ring');
  expect(within(first!).getByText('from ¥24,000').parentElement).toHaveTextContent('from ¥24,000(tax incl.)');
  expect(requests[0]!.searchParams.get('locale')).toBe('en');
});
