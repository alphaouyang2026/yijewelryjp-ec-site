import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Cart, CartLine } from '../../../api';
import { browser } from '../../../browser';
import { emptyCart, emptyHomeData, mockApi } from '../../../test/api-mocks';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';

const PAYMENT_PAGE = 'https://checkout.stripe.test/c/pay/cs_test_1';

const crescentRing: CartLine = {
  lineId: 'Y3Jlc2NlbnQtcmluZy85',
  productSlug: 'crescent-ring',
  sku: '9',
  name: '三日月のリング',
  variantLabel: '9号',
  photo: null,
  priceYen: 9_000,
  quantity: 1,
  maxQuantity: 3,
  lineAmountYen: 9_000,
  available: true,
  notices: [],
};

const oneRing: Cart = {
  ...emptyCart,
  lines: [crescentRing],
  quantity: 1,
  subtotalYen: 9_000,
  shippingYen: 800,
  totalYen: 9_800,
  freeShippingRemainingYen: 11_000,
};

/** Records where the page sends the browser away to (the payment page), instead of going there. */
function watchBrowserLeaving() {
  return vi.spyOn(browser, 'leaveFor').mockImplementation(() => {});
}

beforeEach(() => {
  server.use(mockApi.home(emptyHomeData));
});

test('checking out sends the customer on to the payment page the API created, in the page’s locale', async () => {
  const leaveFor = watchBrowserLeaving();
  const requests: URL[] = [];
  server.use(mockApi.cart(oneRing), mockApi.checkout({ status: 200, body: { url: PAYMENT_PAGE } }, requests));
  renderRoute('/en/cart');

  await userEvent.click(await screen.findByRole('button', { name: 'Check out' }));

  await waitFor(() => expect(leaveFor).toHaveBeenCalledWith(PAYMENT_PAGE));
  expect(requests.map((url) => url.searchParams.get('locale'))).toEqual(['en']);
  // While the browser leaves, the button cannot be pressed again.
  expect(screen.getByRole('button', { name: 'Check out' })).toBeDisabled();
});

test('when some lines can no longer be bought, the page names them and shows the cart as it is now', async () => {
  const leaveFor = watchBrowserLeaving();
  let cart = oneRing;
  server.use(
    mockApi.cart(() => cart),
    mockApi.checkout({
      status: 409,
      body: {
        error: 'unavailable_lines',
        lines: [{ lineId: crescentRing.lineId, name: '三日月のリング', variantLabel: '9号', availableStock: 0 }],
      },
    }),
  );
  renderRoute('/cart');
  const button = await screen.findByRole('button', { name: 'レジに進む' });
  // Meanwhile, the ring sold out.
  cart = {
    ...oneRing,
    lines: [{ ...crescentRing, maxQuantity: 0, lineAmountYen: 0, available: false, notices: [{ code: 'sold_out' }] }],
    subtotalYen: 0,
    shippingYen: 0,
    totalYen: 0,
  };

  await userEvent.click(button);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    '在庫または販売状況が変わったため、ご購入いただけない商品があります：三日月のリング（9号）。カートの内容をご確認ください。',
  );
  expect(await screen.findByText('売り切れのため、ご購入いただけません。')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'レジに進む' })).toBeDisabled();
  expect(leaveFor).not.toHaveBeenCalled();
});

test('names the lines in the page’s locale', async () => {
  server.use(
    mockApi.cart(oneRing),
    mockApi.checkout({
      status: 409,
      body: {
        error: 'unavailable_lines',
        lines: [
          { lineId: 'a', name: '新月戒指', variantLabel: '9号', availableStock: 1 },
          { lineId: 'b', name: '月亮项链', variantLabel: null, availableStock: 0 },
        ],
      },
    }),
  );
  renderRoute('/zh/cart');

  await userEvent.click(await screen.findByRole('button', { name: '去结账' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('无法购买：新月戒指（9号）、月亮项链。');
});

test.each([
  { status: 502 as const, body: { error: 'payment_unavailable' as const } },
  { status: 503 as const, body: { error: 'checkout_busy' as const } },
])(
  'when the payment page cannot be opened ($status), the page says so and the customer can try again',
  async (answer) => {
    const leaveFor = watchBrowserLeaving();
    server.use(mockApi.cart(oneRing), mockApi.checkout(answer));
    renderRoute('/cart');

    await userEvent.click(await screen.findByRole('button', { name: 'レジに進む' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'お支払いページを開けませんでした。時間をおいて、もう一度お試しください。',
    );
    expect(screen.getByRole('button', { name: 'レジに進む' })).toBeEnabled();
    expect(leaveFor).not.toHaveBeenCalled();
  },
);

test('when the API cannot be reached, the page says so', async () => {
  server.use(mockApi.cart(oneRing), mockApi.checkoutUnreachable());
  renderRoute('/cart');

  await userEvent.click(await screen.findByRole('button', { name: 'レジに進む' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('お支払いページを開けませんでした。');
});

test('a cart with nothing that can be bought cannot be checked out', async () => {
  server.use(
    mockApi.cart({
      ...emptyCart,
      lines: [{ ...crescentRing, maxQuantity: 0, lineAmountYen: 0, available: false, notices: [{ code: 'unlisted' }] }],
      quantity: 1,
    }),
  );
  renderRoute('/cart');

  expect(await screen.findByRole('button', { name: 'レジに進む' })).toBeDisabled();
});

test('an empty cart offers no checkout', async () => {
  renderRoute('/cart');

  await screen.findByText('カートに商品はありません。');
  expect(screen.queryByRole('button', { name: 'レジに進む' })).not.toBeInTheDocument();
});
