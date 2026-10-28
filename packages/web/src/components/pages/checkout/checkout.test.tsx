import { screen, within } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import type { Cart } from '../../../api';
import { emptyCart, emptyHomeData, mockApi } from '../../../test/api-mocks';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';

const ORDER = '20261028153012-7KQ3';
const TOKEN = 'checkout-token-1';

beforeEach(() => {
  server.use(mockApi.home(emptyHomeData));
});

test('the thank-you page shows the order number, and that the order is being confirmed until the payment is', async () => {
  const requests: URL[] = [];
  server.use(mockApi.checkoutOrder({ orderNumber: ORDER, status: 'pending_payment' }, TOKEN, requests));

  renderRoute(`/checkout/complete?order=${ORDER}&token=${TOKEN}`);

  expect(await screen.findByRole('heading', { level: 1, name: 'ご注文ありがとうございます' })).toBeInTheDocument();
  const details = screen.getByRole('main');
  expect(within(details).getByText('注文番号').nextElementSibling).toHaveTextContent(ORDER);
  expect(within(details).getByText('ご注文状況').nextElementSibling).toHaveTextContent('確認中');
  expect(details).toHaveTextContent('お支払いの確認が取れ次第、ご注文確定のメールをお送りします。');
  expect(within(details).getByRole('link', { name: 'お買い物を続ける' })).toHaveAttribute('href', '/products');
  expect(document.title).toBe('ご注文ありがとうございます | Y&I Jewelry');
  expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  expect(requests.map((url) => url.searchParams.get('token'))).toEqual([TOKEN]);
});

test('in the locale of its URL', async () => {
  server.use(mockApi.checkoutOrder({ orderNumber: ORDER, status: 'pending_payment' }, TOKEN));

  renderRoute(`/zh/checkout/complete?order=${ORDER}&token=${TOKEN}`);

  expect(await screen.findByRole('heading', { level: 1, name: '感谢您的订购' })).toBeInTheDocument();
  expect(screen.getByText('订单状态').nextElementSibling).toHaveTextContent('订单确认中');
  expect(screen.getByRole('link', { name: '继续购物' })).toHaveAttribute('href', '/zh/products');
});

test('an order the API does not find with the token is not found', async () => {
  server.use(mockApi.checkoutOrder({ orderNumber: ORDER, status: 'pending_payment' }, TOKEN));

  renderRoute(`/checkout/complete?order=${ORDER}&token=another-token`);

  expect(await screen.findByRole('heading', { name: 'ページが見つかりません' })).toBeInTheDocument();
});

test('leaving the payment page cancels the checkout with its token, then shows the cart, its stock available again', async () => {
  const requests: Request[] = [];
  const ring: Cart['lines'][number] = {
    lineId: 'Y3Jlc2NlbnQtcmluZy85',
    productSlug: 'crescent-ring',
    sku: '9',
    name: '三日月のリング',
    variantLabel: '9号',
    photo: null,
    priceYen: 9_000,
    quantity: 1,
    maxQuantity: 1,
    lineAmountYen: 9_000,
    available: true,
    notices: [],
  };
  server.use(
    mockApi.checkoutCancel(204, requests),
    mockApi.cart({ ...emptyCart, lines: [ring], quantity: 1, subtotalYen: 9_000, shippingYen: 800, totalYen: 9_800 }),
  );

  renderRoute(`/en/checkout/cancelled?order=${ORDER}&token=${TOKEN}`);

  expect(await screen.findByRole('heading', { level: 1, name: 'Shopping Cart' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Check out' })).toBeEnabled();
  expect(requests).toHaveLength(1);
  expect(new URL(requests[0]!.url).pathname).toBe(`/api/checkout/orders/${ORDER}/cancel`);
  expect(await requests[0]!.json()).toEqual({ token: TOKEN });
});

test('shows the cart even when the checkout could not be cancelled', async () => {
  server.use(mockApi.checkoutCancel(502));

  renderRoute(`/checkout/cancelled?order=${ORDER}&token=${TOKEN}`);

  expect(await screen.findByRole('heading', { level: 1, name: 'ショッピングカート' })).toBeInTheDocument();
});
