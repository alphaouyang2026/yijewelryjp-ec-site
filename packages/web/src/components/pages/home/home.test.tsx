import { screen, within } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { emptyHomeData, mockApi } from '../../../test/api-mocks';
import { linkHrefs, linkTexts } from '../../../test/queries';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';

beforeEach(() => {
  server.use(mockApi.home(emptyHomeData));
});

test('/ is the home page in Japanese', async () => {
  renderRoute('/');

  expect(await screen.findByRole('region', { name: '新作' })).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute('lang', 'ja');
});

test('header shows the Y&I Jewelry logo, linking to the home page', async () => {
  renderRoute('/');

  const header = await screen.findByRole('banner');
  const homeLink = within(header).getByRole('link', { name: 'Y&I Jewelry' });
  expect(homeLink).toHaveAttribute('href', '/');
  expect(within(homeLink).getByRole('img', { name: 'Y&I Jewelry' })).toBeInTheDocument();
});

test('header navigation lists new arrivals and the categories from the API', async () => {
  server.use(
    mockApi.home({
      ...emptyHomeData,
      categories: [
        { slug: 'ring', name: 'リング' },
        { slug: 'necklace', name: 'ネックレス' },
      ],
    }),
  );

  renderRoute('/');

  const nav = await screen.findByRole('navigation', { name: 'カテゴリー' });
  expect(linkTexts(nav)).toEqual(['新作', 'リング', 'ネックレス']);
  expect(within(nav).getByRole('link', { name: 'リング' })).toHaveAttribute('href', '/categories/ring');
});

test('footer shows the logo, links to the shopping guide and categories, and the contact email', async () => {
  server.use(mockApi.home({ ...emptyHomeData, categories: [{ slug: 'ring', name: 'リング' }] }));

  renderRoute('/');

  const footer = await screen.findByRole('contentinfo');
  expect(within(footer).getByRole('img', { name: 'Y&I Jewelry' })).toBeInTheDocument();
  const guide = within(footer).getByRole('navigation', { name: 'ショッピングガイド' });
  expect(linkTexts(guide)).toEqual([
    '配送・返品について',
    '特定商取引法に基づく表記',
    'プライバシーポリシー',
    '利用規約',
  ]);
  const categories = within(footer).getByRole('navigation', { name: 'カテゴリー（フッター）' });
  expect(linkTexts(categories)).toEqual(['新作', 'リング']);
  expect(within(footer).getByText('[メールアドレス]')).toBeInTheDocument();
});

test('new arrivals section shows an empty state while there are no products', async () => {
  renderRoute('/');

  const newArrivals = await screen.findByRole('region', { name: '新作' });
  expect(within(newArrivals).getByText('ただいま新作を準備中です。')).toBeInTheDocument();
});

test('new arrivals show each product with its price and stock, and link to every product', async () => {
  server.use(
    mockApi.home({
      ...emptyHomeData,
      newArrivals: [
        { slug: 'crescent-ring', name: '三日月のリング', priceYen: 24_000, priceVaries: true, stockStatus: 'in_stock' },
        { slug: 'pearl-earrings', name: 'パールピアス', priceYen: 28_000, priceVaries: false, stockStatus: 'sold_out' },
      ],
    }),
  );

  renderRoute('/');

  const newArrivals = await screen.findByRole('region', { name: '新作' });
  const items = within(newArrivals).getAllByRole('listitem');
  expect(items.map((item) => within(item).getByRole('heading').textContent)).toEqual(['三日月のリング', 'パールピアス']);
  expect(within(items[0]!).getByRole('link')).toHaveAttribute('href', '/products/crescent-ring');
  expect(within(items[0]!).getByText('¥24,000〜').parentElement).toHaveTextContent('¥24,000〜（税込）');
  expect(within(items[1]!).getByText('SOLD OUT')).toBeInTheDocument();
  expect(within(newArrivals).getByRole('link', { name: 'すべての新作を見る' })).toHaveAttribute('href', '/products');
});

test('the featured product is picked up with its description, details and a link to its page', async () => {
  server.use(
    mockApi.home({
      ...emptyHomeData,
      featured: {
        slug: 'crescent-ring',
        name: '三日月のリング',
        priceYen: 24_000,
        priceVaries: true,
        stockStatus: 'in_stock',
        description: '細い三日月をかたどったリングです。',
        materials: 'K18イエローゴールド',
        variantLabels: ['7号', '9号', '11号'],
      },
    }),
  );

  renderRoute('/');

  const featured = await screen.findByRole('region', { name: '三日月のリング' });
  expect(within(featured).getByText('Pick Up')).toBeInTheDocument();
  expect(within(featured).getByText('細い三日月をかたどったリングです。')).toBeInTheDocument();
  expect(within(featured).getByText('素材').nextElementSibling).toHaveTextContent('K18イエローゴールド');
  expect(within(featured).getByText('サイズ').nextElementSibling).toHaveTextContent('7号 / 9号 / 11号');
  expect(within(featured).getByRole('link', { name: '詳しく見る' })).toHaveAttribute('href', '/products/crescent-ring');
});

test('without a featured product, nothing is picked up', async () => {
  renderRoute('/');

  await screen.findByRole('region', { name: '新作' });
  expect(screen.queryByText('Pick Up')).not.toBeInTheDocument();
});

test('the categories are offered as links to their pages', async () => {
  server.use(
    mockApi.home({
      ...emptyHomeData,
      categories: [
        { slug: 'rings', name: 'リング' },
        { slug: 'necklaces', name: 'ネックレス' },
      ],
    }),
  );

  renderRoute('/');

  const categories = await screen.findByRole('region', { name: 'カテゴリーから探す' });
  expect(linkTexts(categories)).toEqual(['リング', 'ネックレス']);
  expect(linkHrefs(categories)).toEqual(['/categories/rings', '/categories/necklaces']);
});

test('announces the free shipping threshold above the header', async () => {
  renderRoute('/');

  expect(await screen.findByText('¥[金額]以上のご購入で、国内送料無料')).toBeInTheDocument();
});

test('header links to the cart', async () => {
  renderRoute('/');

  const header = await screen.findByRole('banner');
  expect(within(header).getByRole('link', { name: 'カート' })).toHaveAttribute('href', '/cart');
});
