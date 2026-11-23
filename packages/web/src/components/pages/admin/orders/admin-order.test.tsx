import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';
import type { AdminOrder } from '../../../../api';
import { mockApi, ownerSession } from '../../../../test/api-mocks';
import { renderRoute } from '../../../../test/render';
import { server } from '../../../../test/server';

const paidOrder: AdminOrder = {
  orderNumber: '20261101100000-7KQ3',
  status: 'paid',
  placedAt: '2026-11-01T01:00:00.000Z',
  orderedIn: 'zh',
  lines: [{ name: '月のリング', variantLabel: '9号', unitPriceYen: 9_000, quantity: 2, lineAmountYen: 18_000 }],
  subtotalYen: 18_000,
  shippingYen: 800,
  totalYen: 18_800,
  taxIncludedYen: 1_709,
  shippingAddress: {
    name: '山田 花子',
    postalCode: '150-0001',
    prefecture: '東京都',
    city: '渋谷区',
    line1: '神宮前1-2-3',
    line2: 'ジュエリービル 401',
  },
  email: 'hanako@example.com',
  phone: '+819012345678',
  shipment: null,
  shippingNoticeSent: false,
  version: 5,
};

const shippedOrder: AdminOrder = {
  ...paidOrder,
  status: 'shipped',
  shipment: { carrier: 'other', carrierName: '西濃運輸', trackingNumber: 'A-1', shippedAt: '2026-11-03T06:00:00.000Z' },
  shippingNoticeSent: true,
  version: 7,
};

/** Each term of the page's first description list with its value. */
function details() {
  const list = screen.getAllByRole('term')[0]?.closest('dl');
  if (!list) throw new Error('No description list');
  return within(list)
    .getAllByRole('term')
    .map((term) => [term.textContent, term.nextElementSibling?.textContent]);
}

test('an order’s page shows its status, the customer’s contact details, its lines and amounts, and where it ships', async () => {
  const requests: URL[] = [];
  server.use(mockApi.adminSession(ownerSession), mockApi.adminOrder(paidOrder, requests));

  renderRoute('/admin/orders/20261101100000-7KQ3');

  expect(await screen.findByRole('heading', { level: 1, name: '注文 20261101100000-7KQ3' })).toBeInTheDocument();
  expect(details()).toEqual([
    ['注文日時', '2026年11月1日 10:00'],
    ['状態', '支払い済み'],
    ['注文時の言語', '中文'],
    ['メールアドレス', 'hanako@example.com'],
    ['電話番号', '+819012345678'],
  ]);
  expect(within(screen.getByRole('table')).getByText('月のリング')).toBeInTheDocument();
  expect(screen.getByText('¥18,800（うち消費税 ¥1,709）')).toBeInTheDocument();
  expect(screen.getByText('渋谷区神宮前1-2-3', { exact: false })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '注文一覧へ' })).toHaveAttribute('href', '/admin/orders');
  expect(requests.map((url) => Object.fromEntries(url.searchParams))).toEqual([{ locale: 'ja' }]);
});

test('before the payment, the page says the contact details and address come with it', async () => {
  server.use(
    mockApi.adminSession(ownerSession),
    mockApi.adminOrder({ ...paidOrder, status: 'pending_payment', shippingAddress: null, email: null, phone: null }),
  );

  renderRoute('/zh/admin/orders/20261101100000-7KQ3');

  expect(await screen.findByRole('heading', { level: 1, name: '订单 20261101100000-7KQ3' })).toBeInTheDocument();
  expect(details()).toEqual([
    ['下单时间', '2026年11月1日 10:00'],
    ['状态', '待付款'],
    ['下单时的语言', '中文'],
    ['邮箱', '—'],
    ['电话', '—'],
  ]);
  expect(screen.getByText('确认付款后显示。')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '标记为已发货' })).not.toBeInTheDocument();
});

test('the owner ships a paid order: the carrier (named, for another one) and tracking number go with the CSRF token', async () => {
  let current = paidOrder;
  const requests: Request[] = [];
  server.use(
    mockApi.adminSession(ownerSession),
    mockApi.adminOrder(() => current),
    mockApi.adminShipOrder(() => {
      current = shippedOrder;
      return { status: 200, body: shippedOrder };
    }, requests),
  );
  const user = userEvent.setup();
  renderRoute('/admin/orders/20261101100000-7KQ3');

  await user.selectOptions(await screen.findByLabelText('配送業者'), 'その他');
  await user.type(screen.getByLabelText('配送業者名'), '西濃運輸');
  await user.type(screen.getByLabelText('伝票番号'), 'A-1');
  await user.click(screen.getByRole('button', { name: '発送済みにする' }));

  expect(await screen.findByText('発送済みにしました。')).toBeInTheDocument();
  expect(requests[0]?.headers.get('X-CSRF-Token')).toBe(ownerSession.csrfToken);
  expect(new URL(requests[0]?.url ?? '').searchParams.get('locale')).toBe('ja');
  expect(await requests[0]?.json()).toEqual({ version: 5, carrier: 'other', carrierName: '西濃運輸', trackingNumber: 'A-1' });
  await waitFor(() =>
    expect(details()).toEqual([
      ['注文日時', '2026年11月1日 10:00'],
      ['状態', '発送済み'],
      ['注文時の言語', '中文'],
      ['メールアドレス', 'hanako@example.com'],
      ['電話番号', '+819012345678'],
      ['配送業者', '西濃運輸'],
      ['伝票番号', 'A-1'],
      ['発送日時', '2026年11月3日 15:00'],
    ]),
  );
  expect(screen.queryByRole('button', { name: '発送済みにする' })).not.toBeInTheDocument();
});

test('a carrier of the list goes without a name', async () => {
  const requests: Request[] = [];
  server.use(
    mockApi.adminSession(ownerSession),
    mockApi.adminOrder(paidOrder),
    mockApi.adminShipOrder({ status: 200, body: { ...shippedOrder, shipment: null } }, requests),
  );
  const user = userEvent.setup();
  renderRoute('/admin/orders/20261101100000-7KQ3');

  await user.selectOptions(await screen.findByLabelText('配送業者'), '佐川急便');
  await user.type(screen.getByLabelText('伝票番号'), '1234');
  await user.click(screen.getByRole('button', { name: '発送済みにする' }));

  await screen.findByText('発送済みにしました。');
  expect(screen.queryByLabelText('配送業者名')).not.toBeInTheDocument();
  expect(await requests[0]?.json()).toEqual({ version: 5, carrier: 'sagawa', trackingNumber: '1234' });
});

test('the shipment form shows the API’s errors next to each field', async () => {
  server.use(
    mockApi.adminSession(ownerSession),
    mockApi.adminOrder(paidOrder),
    mockApi.adminShipOrder({
      status: 400,
      body: {
        error: 'invalid_input',
        fields: [
          { path: 'carrierName', code: 'required' },
          { path: 'trackingNumber', code: 'too_long' },
        ],
      },
    }),
  );
  const user = userEvent.setup();
  renderRoute('/admin/orders/20261101100000-7KQ3');

  await user.selectOptions(await screen.findByLabelText('配送業者'), 'その他');
  await user.type(screen.getByLabelText('伝票番号'), 'x'.repeat(41));
  await user.click(screen.getByRole('button', { name: '発送済みにする' }));

  await waitFor(() => expect(screen.getByLabelText('配送業者名')).toHaveAccessibleDescription('入力してください。'));
  expect(screen.getByLabelText('伝票番号')).toHaveAccessibleDescription('長すぎます。');
  expect(screen.getByLabelText('配送業者')).not.toHaveAttribute('aria-invalid');
});

test('a shipping notice that could not be sent says so, and the owner sends it again', async () => {
  let current: AdminOrder = { ...shippedOrder, shippingNoticeSent: false };
  const requests: Request[] = [];
  server.use(
    mockApi.adminSession(ownerSession),
    mockApi.adminOrder(() => current),
    mockApi.adminSendShippingNotice(() => {
      current = shippedOrder;
      return { status: 200, body: shippedOrder };
    }, requests),
  );
  const user = userEvent.setup();
  renderRoute('/admin/orders/20261101100000-7KQ3');

  expect(await screen.findByText('発送通知メールをお客様に送信できませんでした。')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '発送通知メールを送信' }));

  expect(await screen.findByText('発送通知メールを送信しました。')).toBeInTheDocument();
  expect(requests[0]?.headers.get('X-CSRF-Token')).toBe(ownerSession.csrfToken);
  expect(new URL(requests[0]?.url ?? '').searchParams.get('locale')).toBe('ja');
  await waitFor(() => expect(screen.queryByText('発送通知メールをお客様に送信できませんでした。')).not.toBeInTheDocument());
});

test('a shipping notice that still cannot be sent is not said to be sent', async () => {
  const unsent: AdminOrder = { ...shippedOrder, shippingNoticeSent: false };
  server.use(
    mockApi.adminSession(ownerSession),
    mockApi.adminOrder(unsent),
    mockApi.adminSendShippingNotice({ status: 200, body: unsent }),
  );
  const user = userEvent.setup();
  renderRoute('/admin/orders/20261101100000-7KQ3');

  await user.click(await screen.findByRole('button', { name: '発送通知メールを送信' }));

  expect(await screen.findByText('保存できませんでした。時間をおいて、もう一度お試しください。')).toBeInTheDocument();
  expect(screen.queryByText('発送通知メールを送信しました。')).not.toBeInTheDocument();
  expect(screen.getByText('発送通知メールをお客様に送信できませんでした。')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '発送通知メールを送信' })).toBeEnabled();
});
