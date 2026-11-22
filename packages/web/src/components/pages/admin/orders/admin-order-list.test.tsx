import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';
import type { AdminOrderList } from '../../../../api';
import { mockApi, ownerSession } from '../../../../test/api-mocks';
import { linkHrefs, linkTexts } from '../../../../test/queries';
import { renderRoute } from '../../../../test/render';
import { server } from '../../../../test/server';

const orders: AdminOrderList = {
  orders: [
    {
      orderNumber: '20261101130000-7KQ3',
      status: 'paid',
      placedAt: '2026-11-01T04:00:00.000Z',
      recipient: '山田 花子',
      quantity: 2,
      totalYen: 20_000,
    },
    {
      orderNumber: '20261031090000-ABCD',
      status: 'shipped',
      placedAt: '2026-10-31T00:00:00.000Z',
      recipient: '佐藤 一郎',
      quantity: 1,
      totalYen: 10_800,
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

test('the orders page lists the orders, the most recent first, each linking to its page', async () => {
  const requests: URL[] = [];
  server.use(mockApi.adminSession(ownerSession), mockApi.adminOrders(orders, requests));

  renderRoute('/admin/orders');

  expect(await screen.findByRole('heading', { level: 1, name: '注文' })).toBeInTheDocument();
  const table = screen.getByRole('table');
  expect(rowTexts(table)).toEqual([
    ['20261101130000-7KQ3', '2026年11月1日 13:00', '山田 花子', '2', '¥20,000', '支払い済み'],
    ['20261031090000-ABCD', '2026年10月31日 9:00', '佐藤 一郎', '1', '¥10,800', '発送済み'],
  ]);
  expect(within(table).getByRole('link', { name: '20261101130000-7KQ3' })).toHaveAttribute(
    'href',
    '/admin/orders/20261101130000-7KQ3',
  );
  expect(requests.map((url) => Object.fromEntries(url.searchParams))).toEqual([{}]);
});

test('the status filter asks the API for one status, and marks the current one', async () => {
  const requests: URL[] = [];
  server.use(mockApi.adminSession(ownerSession), mockApi.adminOrders(orders, requests));
  const user = userEvent.setup();
  renderRoute('/en/admin/orders');
  const filter = await screen.findByRole('navigation', { name: 'Status' });
  expect(linkTexts(filter)).toEqual(['Confirmed', 'Paid', 'Shipped', 'Cancelled', 'Awaiting payment', 'Expired']);
  expect(linkHrefs(filter)).toEqual([
    '/en/admin/orders',
    '/en/admin/orders?status=paid',
    '/en/admin/orders?status=shipped',
    '/en/admin/orders?status=cancelled',
    '/en/admin/orders?status=pending_payment',
    '/en/admin/orders?status=expired',
  ]);
  expect(within(filter).getByRole('link', { name: 'Confirmed' })).toHaveAttribute('aria-current', 'page');

  await user.click(within(filter).getByRole('link', { name: 'Expired' }));

  await waitFor(() => expect(within(filter).getByRole('link', { name: 'Expired' })).toHaveAttribute('aria-current', 'page'));
  expect(Object.fromEntries(requests.at(-1)?.searchParams ?? [])).toEqual({ status: 'expired' });
});

test('an empty list says so', async () => {
  server.use(mockApi.adminSession(ownerSession), mockApi.adminOrders({ orders: [] }));

  renderRoute('/zh/admin/orders?status=cancelled');

  expect(await screen.findByText('没有符合条件的订单。')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
