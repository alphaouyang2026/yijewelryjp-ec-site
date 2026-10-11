import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';
import type { AdminProductList } from '../../../api';
import { mockApi, ownerSession } from '../../../test/api-mocks';
import { linkHrefs, linkTexts } from '../../../test/queries';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';

const products: AdminProductList = {
  products: [
    {
      slug: 'moon-ring',
      name: '月のリング',
      status: 'listed',
      featured: true,
      category: { slug: 'rings', name: 'リング' },
      priceYen: 24_000,
      priceVaries: true,
      onHandStock: 5,
      reservedStock: 1,
    },
    {
      slug: 'star-brooch',
      name: '星のブローチ',
      status: 'draft',
      featured: false,
      category: null,
      priceYen: 8_000,
      priceVaries: false,
      onHandStock: 0,
      reservedStock: 0,
    },
    {
      slug: 'old-chain',
      name: '終売のチェーン',
      status: 'archived',
      featured: false,
      category: null,
      priceYen: 12_000,
      priceVaries: false,
      onHandStock: 3,
      reservedStock: 0,
    },
  ],
};

/** Each row of the table (header row excluded), as the text of its cells. */
function rowTexts(table: HTMLElement) {
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    );
}

test('the products page lists every product with its status, each linking to its edit page', async () => {
  const requests: URL[] = [];
  server.use(mockApi.adminSession(ownerSession), mockApi.adminProducts(products, requests));

  renderRoute('/admin/products');

  expect(await screen.findByRole('heading', { level: 1, name: '商品' })).toBeInTheDocument();
  const table = screen.getByRole('table');
  expect(rowTexts(table)).toEqual([
    ['月のリング', '販売中', 'リング', '¥24,000〜', '5（確保中 1）', 'ピックアップ'],
    ['星のブローチ', '下書き', '—', '¥8,000', '0', ''],
    ['終売のチェーン', 'アーカイブ', '—', '¥12,000', '3', ''],
  ]);
  expect(within(table).getByRole('link', { name: '月のリング' })).toHaveAttribute('href', '/admin/products/moon-ring/edit');
  expect(screen.getByRole('link', { name: '商品を追加' })).toHaveAttribute('href', '/admin/products/new');
  expect(requests.map((url) => Object.fromEntries(url.searchParams))).toEqual([{ locale: 'ja' }]);
});

test('the status filter asks the API for one status, and marks the current one', async () => {
  const requests: URL[] = [];
  server.use(mockApi.adminSession(ownerSession), mockApi.adminProducts(products, requests));
  const user = userEvent.setup();
  renderRoute('/en/admin/products');
  const filter = await screen.findByRole('navigation', { name: 'Status' });
  expect(linkTexts(filter)).toEqual(['All', 'Draft', 'Listed', 'Archived']);
  expect(linkHrefs(filter)).toEqual([
    '/en/admin/products',
    '/en/admin/products?status=draft',
    '/en/admin/products?status=listed',
    '/en/admin/products?status=archived',
  ]);
  expect(within(filter).getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'page');

  await user.click(within(filter).getByRole('link', { name: 'Draft' }));

  await waitFor(() => expect(within(filter).getByRole('link', { name: 'Draft' })).toHaveAttribute('aria-current', 'page'));
  expect(Object.fromEntries(requests.at(-1)?.searchParams ?? [])).toEqual({ locale: 'en', status: 'draft' });
});

test('an empty list says so', async () => {
  server.use(mockApi.adminSession(ownerSession), mockApi.adminProducts({ products: [] }));

  renderRoute('/zh/admin/products?status=archived');

  expect(await screen.findByText('没有符合条件的商品。')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
