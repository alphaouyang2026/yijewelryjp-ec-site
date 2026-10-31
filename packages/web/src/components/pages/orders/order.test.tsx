import { screen, within } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import type { OrderPage } from '../../../api';
import { emptyHomeData, mockApi } from '../../../test/api-mocks';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';

const ORDER = '20261028153012-7KQ3';
const TOKEN = 'checkout-token-1';

const paidOrder: OrderPage = {
  orderNumber: ORDER,
  status: 'paid',
  // 15:30 on 28 October 2026 in Japan.
  placedAt: '2026-10-28T06:30:12.000Z',
  lines: [
    { name: '月のリング', variantLabel: '9号', unitPriceYen: 9_000, quantity: 1, lineAmountYen: 9_000 },
    { name: '星のネックレス', variantLabel: '45cm', unitPriceYen: 4_000, quantity: 2, lineAmountYen: 8_000 },
  ],
  subtotalYen: 17_000,
  shippingYen: 800,
  totalYen: 17_800,
  taxYen: 1_618,
  shippingAddress: {
    name: '山田 花子',
    postalCode: '150-0001',
    prefecture: '東京都',
    city: '渋谷区',
    line1: '神宮前1-2-3',
    line2: 'ジュエリービル 401',
  },
};

beforeEach(() => {
  server.use(mockApi.home(emptyHomeData));
});

test('the order page shows the order: its status, lines, amounts with the tax included, and where it ships', async () => {
  const requests: URL[] = [];
  server.use(mockApi.orderPage(paidOrder, TOKEN, requests));

  renderRoute(`/orders/${ORDER}?token=${TOKEN}`);

  expect(await screen.findByRole('heading', { level: 1, name: 'ご注文内容' })).toBeInTheDocument();
  const main = screen.getByRole('main');
  expect(within(main).getByText('注文番号').nextElementSibling).toHaveTextContent(ORDER);
  expect(within(main).getByText('ご注文日時').nextElementSibling).toHaveTextContent('2026年10月28日 15:30');
  expect(within(main).getByText('ご注文状況').nextElementSibling).toHaveTextContent('お支払い済み');

  const rows = within(within(main).getByRole('table')).getAllByRole('row');
  expect(rows.map((row) => within(row).queryAllByRole('cell').map((cell) => cell.textContent))).toEqual([
    [],
    ['月のリング9号', '¥9,000', '1', '¥9,000'],
    ['星のネックレス45cm', '¥4,000', '2', '¥8,000'],
  ]);
  expect(within(main).getByText('小計').nextElementSibling).toHaveTextContent('¥17,000');
  expect(within(main).getByText('送料').nextElementSibling).toHaveTextContent('¥800');
  expect(within(main).getByText('合計').nextElementSibling).toHaveTextContent('¥17,800（うち消費税 ¥1,618）');

  const address = within(main).getByRole('region', { name: 'お届け先' });
  expect(address).toHaveTextContent('〒150-0001');
  expect(address).toHaveTextContent('東京都渋谷区神宮前1-2-3 ジュエリービル 401');
  expect(address).toHaveTextContent('山田 花子 様');

  expect(document.title).toBe('ご注文内容 | Y&I Jewelry');
  expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  expect(requests.map((url) => [url.searchParams.get('token'), url.searchParams.get('locale')])).toEqual([
    [TOKEN, 'ja'],
  ]);
});

test('in the locale of its URL', async () => {
  const requests: URL[] = [];
  server.use(mockApi.orderPage(paidOrder, TOKEN, requests));

  renderRoute(`/en/orders/${ORDER}?token=${TOKEN}`);

  expect(await screen.findByRole('heading', { level: 1, name: 'Your order' })).toBeInTheDocument();
  expect(screen.getByText('Ordered on').nextElementSibling).toHaveTextContent('October 28, 2026 at 3:30 PM');
  expect(screen.getByText('Total').nextElementSibling).toHaveTextContent('¥17,800 (including ¥1,618 consumption tax)');
  expect(screen.getByRole('region', { name: 'Shipping address' })).not.toHaveTextContent('様');
  expect(requests.map((url) => url.searchParams.get('locale'))).toEqual(['en']);
});

test('before the payment is confirmed, the address is not there yet', async () => {
  server.use(mockApi.orderPage({ ...paidOrder, status: 'pending_payment', shippingAddress: null }, TOKEN));

  renderRoute(`/orders/${ORDER}?token=${TOKEN}`);

  const address = await screen.findByRole('region', { name: 'お届け先' });
  expect(address).toHaveTextContent('お支払いの確認後に表示されます。');
  expect(screen.getByText('ご注文状況').nextElementSibling).toHaveTextContent('確認中');
});

test('an order the API does not find with the token is not found', async () => {
  server.use(mockApi.orderPage(paidOrder, TOKEN));

  renderRoute(`/orders/${ORDER}?token=another-token`);

  expect(await screen.findByRole('heading', { name: 'ページが見つかりません' })).toBeInTheDocument();
});
