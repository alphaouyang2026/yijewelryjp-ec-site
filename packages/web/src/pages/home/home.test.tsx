import { screen, within } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { emptyHomeData, mockApi } from '../../test/api-mocks';
import { renderRoute } from '../../test/render';
import { server } from '../../test/server';

beforeEach(() => {
  server.use(mockApi.home(emptyHomeData));
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
  expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
    '新作',
    'リング',
    'ネックレス',
  ]);
  expect(within(nav).getByRole('link', { name: 'リング' })).toHaveAttribute('href', '/categories/ring');
});

test('footer shows the logo, links to the shopping guide and categories, and the contact email', async () => {
  server.use(mockApi.home({ ...emptyHomeData, categories: [{ slug: 'ring', name: 'リング' }] }));

  renderRoute('/');

  const footer = await screen.findByRole('contentinfo');
  expect(within(footer).getByRole('img', { name: 'Y&I Jewelry' })).toBeInTheDocument();
  const guide = within(footer).getByRole('navigation', { name: 'ショッピングガイド' });
  expect(within(guide).getAllByRole('link').map((link) => link.textContent)).toEqual([
    '配送・返品について',
    '特定商取引法に基づく表記',
    'プライバシーポリシー',
    '利用規約',
  ]);
  const categories = within(footer).getByRole('navigation', { name: 'カテゴリー（フッター）' });
  expect(within(categories).getAllByRole('link').map((link) => link.textContent)).toEqual(['新作', 'リング']);
  expect(within(footer).getByText('[メールアドレス]')).toBeInTheDocument();
});

test('new arrivals section shows an empty state while there are no products', async () => {
  renderRoute('/');

  const newArrivals = await screen.findByRole('region', { name: '新作' });
  expect(within(newArrivals).getByText('ただいま新作を準備中です。')).toBeInTheDocument();
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
