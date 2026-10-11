import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vitest';
import type { Cart, CartLine } from '../../../api';
import { emptyCart, emptyHomeData, mockApi } from '../../../test/api-mocks';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';

const crescentRing: CartLine = {
  lineId: 'Y3Jlc2NlbnQtcmluZy85',
  productSlug: 'crescent-ring',
  sku: '9',
  name: '三日月のリング',
  variantLabel: '9号',
  photo: { url: '/images/products/crescent.jpg', alt: '正面から見た三日月のリング' },
  priceYen: 9_000,
  quantity: 1,
  maxQuantity: 3,
  lineTotalYen: 9_000,
  available: true,
  notices: [],
};

/** A cart with one ring, ¥11,000 short of free shipping. */
const oneRing: Cart = {
  ...emptyCart,
  lines: [crescentRing],
  itemCount: 1,
  subtotalYen: 9_000,
  shippingYen: 800,
  totalYen: 9_800,
  freeShippingRemainingYen: 11_000,
};

/** The same cart once the ring's quantity is 2. */
const twoRings: Cart = {
  ...oneRing,
  lines: [{ ...crescentRing, quantity: 2, lineTotalYen: 18_000 }],
  itemCount: 2,
  subtotalYen: 18_000,
  totalYen: 18_800,
  freeShippingRemainingYen: 2_000,
};

/** A cart whose lines the catalog has changed under: each kind of notice, and free shipping reached. */
const changedCart: Cart = {
  ...emptyCart,
  lines: [
    { ...crescentRing, priceYen: 24_000, lineTotalYen: 24_000, notices: [{ code: 'price_changed', previousPriceYen: 22_000 }] },
    {
      lineId: 'cGVhcmwtZWFycmluZ3Mvb25l',
      productSlug: 'pearl-earrings',
      sku: 'one',
      name: 'パールピアス',
      variantLabel: 'フリー',
      photo: null,
      priceYen: 28_000,
      quantity: 1,
      maxQuantity: 0,
      lineTotalYen: 0,
      available: false,
      notices: [{ code: 'sold_out' }],
    },
    {
      lineId: 'bW9vbi1uZWNrbGFjZS80NWNt',
      productSlug: 'moon-necklace',
      sku: '45cm',
      name: '月のネックレス',
      variantLabel: null,
      photo: null,
      priceYen: 18_000,
      quantity: 1,
      maxQuantity: 0,
      lineTotalYen: 0,
      available: false,
      notices: [{ code: 'unlisted' }],
    },
    {
      lineId: 'c3Rhci1yaW5nLzEx',
      productSlug: 'star-ring',
      sku: '11',
      name: '星のリング',
      variantLabel: '11号',
      photo: null,
      priceYen: 6_000,
      quantity: 1,
      maxQuantity: 1,
      lineTotalYen: 6_000,
      available: true,
      notices: [{ code: 'quantity_reduced', requestedQuantity: 3 }],
    },
  ],
  itemCount: 4,
  subtotalYen: 30_000,
  shippingYen: 0,
  totalYen: 30_000,
  freeShippingRemainingYen: 0,
};

/** The cart's lines, in order. */
function cartLines(): HTMLElement[] {
  return within(screen.getByRole('list', { name: /カート内の商品|购物车中的商品|Items in your cart/ })).getAllByRole(
    'listitem',
  );
}

/** The cart line showing the product `name`. */
function lineOf(name: string): HTMLElement {
  const line = cartLines().find((item) => within(item).queryByRole('link', { name }));
  if (!line) throw new Error(`No cart line for ${name}`);
  return line;
}

/** The amount the order summary shows for `term` (subtotal, shipping, total). */
function summaryAmount(term: string): string | null | undefined {
  const summary = screen.getByRole('region', { name: /ご注文金額|订单金额|Order summary/ });
  return within(summary).getByText(term).nextElementSibling?.textContent;
}

beforeEach(() => {
  server.use(mockApi.home({ ...emptyHomeData, categories: [{ slug: 'rings', name: 'リング' }] }));
});

test('an empty cart says so and links to the products; the page is not for search engines', async () => {
  renderRoute('/cart');

  expect(await screen.findByRole('heading', { level: 1, name: 'ショッピングカート' })).toBeInTheDocument();
  expect(screen.getByText('カートに商品はありません。')).toBeInTheDocument();
  expect(within(screen.getByRole('main')).getByRole('link', { name: '商品を見る' })).toHaveAttribute('href', '/products');
  expect(screen.queryByRole('region', { name: 'ご注文金額' })).not.toBeInTheDocument();
  expect(document.title).toBe('ショッピングカート | Y&I Jewelry');
  expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  // The navigation still shows the store's categories.
  expect(within(screen.getByRole('banner')).getByRole('link', { name: 'リング' })).toBeInTheDocument();
});

test('shows each line and the amounts as the API computed them, with what is left to free shipping', async () => {
  const requests: URL[] = [];
  server.use(mockApi.cart(oneRing, requests));

  renderRoute('/cart');

  await screen.findByRole('list', { name: 'カート内の商品' });
  const [line, ...others] = cartLines();
  expect(others).toEqual([]);
  if (!line) throw new Error('No cart line');
  expect(within(line).getByRole('link', { name: '三日月のリング' })).toHaveAttribute('href', '/products/crescent-ring');
  expect(within(line).getByRole('img', { name: '正面から見た三日月のリング' })).toHaveAttribute(
    'src',
    '/images/products/crescent.jpg',
  );
  expect(within(line).getByText('9号')).toBeInTheDocument();
  expect(within(line).getByText('（税込）').parentElement).toHaveTextContent('¥9,000（税込）');
  expect(within(line).getByRole('group', { name: '数量' })).toHaveTextContent('1');
  expect(within(line).getByText('小計').nextElementSibling).toHaveTextContent('¥9,000');

  expect(summaryAmount('小計')).toBe('¥9,000');
  expect(summaryAmount('送料')).toBe('¥800');
  expect(summaryAmount('合計（税込）')).toBe('¥9,800');
  expect(screen.getByText('あと¥11,000のご購入で送料無料')).toBeInTheDocument();
  expect(within(screen.getByRole('banner')).getByRole('link', { name: 'カート（1点）' })).toBeInTheDocument();
  expect(requests.map((url) => url.searchParams.get('locale'))).toEqual(['ja', 'ja']);
});

test('shows every notice the API gives, and marks the lines that cannot be bought as not in the total', async () => {
  server.use(mockApi.cart(changedCart));

  renderRoute('/cart');

  await screen.findByRole('list', { name: 'カート内の商品' });
  const repriced = lineOf('三日月のリング');
  expect(repriced).toHaveTextContent('価格が変更されました（変更前 ¥22,000）。');
  expect(within(repriced).getByText('（税込）').parentElement).toHaveTextContent('¥24,000（税込）');

  const soldOut = lineOf('パールピアス');
  expect(soldOut).toHaveTextContent('売り切れのため、ご購入いただけません。');
  expect(soldOut).toHaveTextContent('合計に含まれません');
  for (const button of within(within(soldOut).getByRole('group', { name: '数量' })).getAllByRole('button')) {
    expect(button).toBeDisabled();
  }

  const unlisted = lineOf('月のネックレス');
  expect(unlisted).toHaveTextContent('販売を終了したため、ご購入いただけません。');
  expect(unlisted).toHaveTextContent('合計に含まれません');

  const reduced = lineOf('星のリング');
  expect(reduced).toHaveTextContent('在庫が少なくなったため、数量を3点から変更しました。');
  expect(reduced).not.toHaveTextContent('合計に含まれません');
  expect(within(reduced).getByRole('button', { name: '数量を増やす' })).toBeDisabled();

  expect(summaryAmount('小計')).toBe('¥30,000');
  expect(summaryAmount('送料')).toBe('無料');
  expect(summaryAmount('合計（税込）')).toBe('¥30,000');
  expect(screen.getByText('送料無料でお届けします')).toBeInTheDocument();
});

test('with only lines that cannot be bought, there is nothing to pay and no word of free shipping', async () => {
  const unavailable = changedCart.lines.filter((line) => !line.available);
  server.use(
    mockApi.cart({ ...emptyCart, lines: unavailable, itemCount: 2, freeShippingRemainingYen: 20_000 }),
  );

  renderRoute('/cart');

  await screen.findByRole('list', { name: 'カート内の商品' });
  expect(summaryAmount('小計')).toBe('¥0');
  expect(summaryAmount('送料')).toBe('¥0');
  expect(summaryAmount('合計（税込）')).toBe('¥0');
  expect(within(screen.getByRole('main')).queryByText(/送料無料/)).not.toBeInTheDocument();
});

describe('changing the cart', () => {
  test('changing a quantity asks the API, then shows the amounts it answers with', async () => {
    const user = userEvent.setup();
    const requests: Request[] = [];
    server.use(
      mockApi.cartSetQuantity({ status: 200, body: twoRings }, requests),
      mockApi.cart(() => (requests.length > 0 ? twoRings : oneRing)),
    );
    renderRoute('/cart');

    await user.click(await screen.findByRole('button', { name: '数量を増やす' }));

    expect(await screen.findByText('あと¥2,000のご購入で送料無料')).toBeInTheDocument();
    expect(requests).toHaveLength(1);
    const url = new URL(requests[0]?.url ?? '');
    expect(url.pathname).toBe(`/api/cart/lines/${crescentRing.lineId}`);
    expect(url.searchParams.get('locale')).toBe('ja');
    expect(await requests[0]?.json()).toEqual({ quantity: 2 });
    expect(screen.getByRole('group', { name: '数量' })).toHaveTextContent('2');
    expect(within(lineOf('三日月のリング')).getByText('小計').nextElementSibling).toHaveTextContent('¥18,000');
    expect(summaryAmount('小計')).toBe('¥18,000');
    expect(summaryAmount('合計（税込）')).toBe('¥18,800');
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'カート（2点）' })).toBeInTheDocument();
  });

  test('taking one off sends the lower quantity', async () => {
    const user = userEvent.setup();
    const requests: Request[] = [];
    server.use(
      mockApi.cartSetQuantity({ status: 200, body: oneRing }, requests),
      mockApi.cart(() => (requests.length > 0 ? oneRing : twoRings)),
    );
    renderRoute('/cart');

    await user.click(await screen.findByRole('button', { name: '数量を減らす' }));

    expect(await screen.findByText('あと¥11,000のご購入で送料無料')).toBeInTheDocument();
    expect(await requests[0]?.json()).toEqual({ quantity: 1 });
    expect(screen.getByRole('button', { name: '数量を減らす' })).toBeDisabled();
  });

  test('when there is not enough stock, says how many can be bought and shows the cart as it is now', async () => {
    const user = userEvent.setup();
    const requests: Request[] = [];
    const fewerInStock: Cart = { ...oneRing, lines: [{ ...crescentRing, maxQuantity: 1 }] };
    server.use(
      mockApi.cartSetQuantity({ status: 409, body: { error: 'exceeds_available', availableStock: 1 } }, requests),
      mockApi.cart(() => (requests.length > 0 ? fewerInStock : oneRing)),
    );
    renderRoute('/cart');

    await user.click(await screen.findByRole('button', { name: '数量を増やす' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('在庫が足りません。1点までご購入いただけます。');
    expect(await screen.findByRole('button', { name: '数量を増やす' })).toBeDisabled();
    expect(screen.getByRole('group', { name: '数量' })).toHaveTextContent('1');
  });

  test('when a change fails, says it could not be changed', async () => {
    const user = userEvent.setup();
    server.use(
      mockApi.cartSetQuantity({ status: 404, body: { error: 'not_in_cart' } }),
      mockApi.cart(oneRing),
    );
    renderRoute('/cart');

    await user.click(await screen.findByRole('button', { name: '数量を増やす' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '変更できませんでした。時間をおいて、もう一度お試しください。',
    );
  });

  test('removing a line asks the API to remove it; once the cart is empty, it says so', async () => {
    const user = userEvent.setup();
    const requests: Request[] = [];
    server.use(
      mockApi.cartRemove(emptyCart, requests),
      mockApi.cart(() => (requests.length > 0 ? emptyCart : oneRing)),
    );
    renderRoute('/cart');

    await user.click(await screen.findByRole('button', { name: '三日月のリング（9号）を削除' }));

    expect(await screen.findByText('カートに商品はありません。')).toBeInTheDocument();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('DELETE');
    const url = new URL(requests[0]?.url ?? '');
    expect(url.pathname).toBe(`/api/cart/lines/${crescentRing.lineId}`);
    expect(url.searchParams.get('locale')).toBe('ja');
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'カート' })).toBeInTheDocument();
  });
});

test.each([
  {
    path: '/zh/cart',
    locale: 'zh',
    title: '购物车',
    cart: '购物车（4件）',
    notices: ['价格已变更（原价 ¥22,000）。', '此商品已售罄，无法购买。', '此商品已下架，无法购买。', '库存减少，数量已由3件调整。'],
    notCounted: '不计入合计',
    terms: { subtotal: '小计', shipping: '运费', total: '合计（含税）' },
    free: '免运费',
    reached: '本单免运费',
    remove: '删除三日月のリング（9号）',
  },
  {
    path: '/en/cart',
    locale: 'en',
    title: 'Shopping Cart',
    cart: 'Cart (4 items)',
    notices: [
      'The price has changed (was ¥22,000).',
      'Sold out, so it cannot be bought.',
      'No longer sold, so it cannot be bought.',
      'Stock is low: the quantity was changed from 3.',
    ],
    notCounted: 'Not included in the total',
    terms: { subtotal: 'Subtotal', shipping: 'Shipping', total: 'Total (tax incl.)' },
    free: 'Free',
    reached: 'Your order ships free',
    remove: 'Remove 三日月のリング (9号)',
  },
])('$path shows the cart, its notices and amounts in its locale', async (text) => {
  const requests: URL[] = [];
  server.use(mockApi.cart(changedCart, requests));

  renderRoute(text.path);

  expect(await screen.findByRole('heading', { level: 1, name: text.title })).toBeInTheDocument();
  const lines = cartLines();
  text.notices.forEach((notice, index) => expect(lines[index]).toHaveTextContent(notice));
  expect(lines[1]).toHaveTextContent(text.notCounted);
  expect(within(lines[0] as HTMLElement).getByRole('button', { name: text.remove })).toBeInTheDocument();
  expect(summaryAmount(text.terms.subtotal)).toBe('¥30,000');
  expect(summaryAmount(text.terms.shipping)).toBe(text.free);
  expect(summaryAmount(text.terms.total)).toBe('¥30,000');
  expect(screen.getByText(text.reached)).toBeInTheDocument();
  expect(within(screen.getByRole('banner')).getByRole('link', { name: text.cart })).toHaveAttribute(
    'href',
    `/${text.locale}/cart`,
  );
  expect(requests.map((url) => url.searchParams.get('locale'))).toEqual([text.locale, text.locale]);
});

test.each([
  { path: '/zh/cart', remaining: '再购买¥11,000即可免运费' },
  { path: '/en/cart', remaining: 'Spend ¥11,000 more for free shipping' },
])('$path says what is left to free shipping in its locale', async ({ path, remaining }) => {
  server.use(mockApi.cart(oneRing));

  renderRoute(path);

  expect(await screen.findByText(remaining)).toBeInTheDocument();
});

test('when the cart cannot be read, the page says it could not be shown', async () => {
  server.use(mockApi.cartFails());

  renderRoute('/cart');

  expect(await screen.findByRole('heading', { level: 1, name: 'ページを表示できませんでした' })).toBeInTheDocument();
});
