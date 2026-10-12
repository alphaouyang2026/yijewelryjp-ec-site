import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vitest';
import type { Cart, ProductPage } from '../../../api';
import { emptyCart, emptyHomeData, mockApi } from '../../../test/api-mocks';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';

const categories = [{ slug: 'rings', name: 'リング' }];

const crescentRing: ProductPage = {
  product: {
    slug: 'crescent-ring',
    name: '三日月のリング',
    description: '細い三日月をかたどったリングです。',
    materials: 'K18イエローゴールド',
    dimensions: '幅 約2mm',
    weight: null,
    care: '着用後は柔らかい布で拭いてください。',
    photos: [],
    category: { slug: 'rings', name: 'リング' },
    stockStatus: 'in_stock',
    variants: [
      { sku: '7', label: '7号', priceYen: 24_000, stockStatus: 'in_stock' },
      { sku: '9', label: '9号', priceYen: 24_000, stockStatus: 'low_stock' },
      { sku: '11', label: '11号', priceYen: 25_000, stockStatus: 'in_stock' },
      { sku: '13', label: '13号', priceYen: 25_000, stockStatus: 'sold_out' },
    ],
  },
  categories,
};

const front = { url: '/images/products/front.jpg', alt: '正面から見た三日月のリング' };
const side = { url: '/images/products/side.jpg', alt: '横から見た三日月のリング' };
const worn = { url: '/images/products/worn.jpg', alt: '指につけた三日月のリング' };

const photographedRing: ProductPage = {
  product: { ...crescentRing.product, slug: 'photographed-ring', photos: [front, side, worn] },
  categories,
};

const onePhotoRing: ProductPage = {
  product: { ...crescentRing.product, slug: 'one-photo-ring', photos: [front] },
  categories,
};

const soldOutEarrings: ProductPage = {
  product: {
    ...crescentRing.product,
    slug: 'pearl-earrings',
    name: 'パールピアス',
    stockStatus: 'sold_out',
    variants: [{ sku: 'one', label: 'フリー', priceYen: 28_000, stockStatus: 'sold_out' }],
  },
  categories,
};

beforeEach(() => {
  server.use(
    mockApi.productPages({
      'crescent-ring': crescentRing,
      'pearl-earrings': soldOutEarrings,
      'photographed-ring': photographedRing,
      'one-photo-ring': onePhotoRing,
    }),
    mockApi.home(emptyHomeData),
  );
});

test('shows the product with its details and the price in yen, tax included', async () => {
  renderRoute('/products/crescent-ring');

  const main = await screen.findByRole('main');
  expect(within(main).getByRole('heading', { level: 1, name: '三日月のリング' })).toBeInTheDocument();
  expect(within(main).getByText('¥24,000').parentElement).toHaveTextContent('¥24,000（税込）');
  expect(within(main).getByText('細い三日月をかたどったリングです。')).toBeInTheDocument();
  expect(within(main).getByText('素材').nextElementSibling).toHaveTextContent('K18イエローゴールド');
  expect(within(main).getByText('寸法').nextElementSibling).toHaveTextContent('幅 約2mm');
  // The owner left the weight out, so it is not listed.
  expect(within(main).queryByText('重量')).not.toBeInTheDocument();
  expect(within(main).getByRole('link', { name: 'リング' })).toHaveAttribute('href', '/categories/rings');
});

test('the gallery shows the first photo large, and pressing a thumbnail shows that photo instead', async () => {
  const user = userEvent.setup();
  renderRoute('/products/photographed-ring');

  const thumbnails = await screen.findByRole('list', { name: '商品写真' });
  const large = () => {
    const shown = within(screen.getByRole('main'))
      .getAllByRole('img')
      .filter((img) => !thumbnails.contains(img));
    expect(shown).toHaveLength(1);
    return shown[0];
  };
  const buttons = within(thumbnails).getAllByRole('button');
  expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
  expect(large()).toHaveAttribute('src', front.url);
  expect(large()).toHaveAccessibleName(front.alt);

  await user.click(within(thumbnails).getByRole('button', { name: worn.alt }));

  expect(large()).toHaveAttribute('src', worn.url);
  expect(large()).toHaveAccessibleName(worn.alt);
  expect(within(thumbnails).getByRole('button', { name: worn.alt })).toHaveAttribute('aria-pressed', 'true');
  expect(within(thumbnails).getByRole('button', { name: front.alt })).toHaveAttribute('aria-pressed', 'false');
});

test('every photo on the page says what it shows', async () => {
  renderRoute('/products/photographed-ring');

  const main = await screen.findByRole('main');
  await within(main).findByRole('list', { name: '商品写真' });
  const images = within(main).getAllByRole('img');
  expect(images).toHaveLength(4);
  for (const image of images) expect(image.getAttribute('alt')).toMatch(/\S/);
});

test('a product with one photo shows it with no thumbnails; one without photos shows the photo’s place', async () => {
  const { unmount } = renderRoute('/products/one-photo-ring');

  const main = await screen.findByRole('main');
  expect(within(main).getByRole('img', { name: front.alt })).toHaveAttribute('src', front.url);
  expect(within(main).queryByRole('list', { name: '商品写真' })).not.toBeInTheDocument();
  unmount();

  renderRoute('/products/crescent-ring');
  const bare = await screen.findByRole('main');
  await within(bare).findByRole('heading', { level: 1, name: '三日月のリング' });
  expect(within(bare).queryByRole('img')).not.toBeInTheDocument();
});

test('a sold-out size cannot be chosen; choosing another size shows its price and stock', async () => {
  const user = userEvent.setup();
  renderRoute('/products/crescent-ring');

  const sizes = await screen.findByRole('radiogroup', { name: 'サイズを選択' });
  expect(within(sizes).getByRole('radio', { name: '7号' })).toBeChecked();
  expect(within(sizes).getByRole('radio', { name: '13号' })).toBeDisabled();

  await user.click(within(sizes).getByRole('radio', { name: '11号' }));
  expect(screen.getByText('¥25,000')).toBeInTheDocument();
  expect(screen.getByText('在庫あり')).toBeInTheDocument();

  await user.click(within(sizes).getByRole('radio', { name: '9号' }));
  expect(screen.getByText('¥24,000')).toBeInTheDocument();
  expect(screen.getByText('残りわずか')).toBeInTheDocument();
});

test('a product whose every size is sold out can still be viewed, shows SOLD OUT and offers no size', async () => {
  renderRoute('/products/pearl-earrings');

  const main = await screen.findByRole('main');
  expect(within(main).getByRole('heading', { level: 1, name: 'パールピアス' })).toBeInTheDocument();
  expect(within(main).getByText('SOLD OUT')).toBeInTheDocument();
  const sizes = within(main).getByRole('radiogroup', { name: 'サイズを選択' });
  for (const size of within(sizes).getAllByRole('radio')) {
    expect(size).toBeDisabled();
    expect(size).not.toBeChecked();
  }
});

test('in Chinese, the price says tax included in Chinese and links stay in Chinese', async () => {
  renderRoute('/zh/products/crescent-ring');

  const main = await screen.findByRole('main');
  expect(within(main).getByText('¥24,000').parentElement).toHaveTextContent('¥24,000（含税）');
  expect(within(main).getByRole('link', { name: 'リング' })).toHaveAttribute('href', '/zh/categories/rings');
  expect(document.documentElement).toHaveAttribute('lang', 'zh-Hans');
});

test('a product the API does not know shows the not-found page', async () => {
  renderRoute('/products/no-such-ring');

  expect(await screen.findByRole('heading', { level: 1, name: 'ページが見つかりません' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'トップページへ戻る' })).toHaveAttribute('href', '/');
});

test('a URL the site does not have shows the not-found page, in the URL’s locale', async () => {
  renderRoute('/en/no/such/page');

  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to the home page' })).toHaveAttribute('href', '/en/');
});

describe('adding to the cart', () => {
  /** The cart after adding three of size 9 to an empty cart, as the API answers. */
  const cartWithThree: Cart = {
    ...emptyCart,
    lines: [
      {
        lineId: 'Y3Jlc2NlbnQtcmluZy85',
        productSlug: 'crescent-ring',
        sku: '9',
        name: '三日月のリング',
        variantLabel: '9号',
        photo: null,
        priceYen: 24_000,
        quantity: 3,
        maxQuantity: 3,
        lineAmountYen: 72_000,
        available: true,
        notices: [],
      },
    ],
    quantity: 3,
    subtotalYen: 72_000,
    totalYen: 72_000,
    freeShippingRemainingYen: 0,
  };

  test('adds the chosen size and quantity, says so with a link to the cart, and the header counts them', async () => {
    const user = userEvent.setup();
    const requests: Request[] = [];
    server.use(
      mockApi.cartAdd({ status: 200, body: cartWithThree }, requests),
      mockApi.cart(() => (requests.length > 0 ? cartWithThree : emptyCart)),
    );
    renderRoute('/products/crescent-ring');

    await user.click(await screen.findByRole('radio', { name: '9号' }));
    const quantity = screen.getByRole('group', { name: '数量' });
    expect(within(quantity).getByRole('button', { name: '数量を減らす' })).toBeDisabled();
    await user.click(within(quantity).getByRole('button', { name: '数量を増やす' }));
    await user.click(within(quantity).getByRole('button', { name: '数量を増やす' }));
    expect(quantity).toHaveTextContent('3');
    await user.click(screen.getByRole('button', { name: 'カートに入れる' }));

    const done = await screen.findByRole('status');
    expect(done).toHaveTextContent('カートに追加しました。');
    expect(within(done).getByRole('link', { name: 'カートを見る' })).toHaveAttribute('href', '/cart');
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]?.url ?? '').searchParams.get('locale')).toBe('ja');
    expect(await requests[0]?.json()).toEqual({ productSlug: 'crescent-ring', sku: '9', quantity: 3 });
    expect(await within(screen.getByRole('banner')).findByRole('link', { name: 'カート（3点）' })).toBeInTheDocument();
  });

  test.each([
    {
      refusal: { error: 'exceeds_available', availableStock: 2 } as const,
      text: '在庫が足りません。カート内と合わせて2点までご購入いただけます。',
    },
    { refusal: { error: 'sold_out' } as const, text: 'この商品は売り切れました。' },
    { refusal: { error: 'cart_full', maxLines: 20 } as const, text: 'カートに入れられる商品は20種類までです。' },
    {
      refusal: { error: 'cart_too_large' } as const,
      text: 'カートの内容が多すぎるため、追加できませんでした。カート内の商品を減らしてからお試しください。',
    },
  ])('when the API refuses ($refusal.error), says why', async ({ refusal, text }) => {
    const user = userEvent.setup();
    server.use(mockApi.cartAdd({ status: 409, body: refusal }));
    renderRoute('/products/crescent-ring');

    await user.click(await screen.findByRole('button', { name: 'カートに入れる' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'カート' })).toBeInTheDocument();
  });

  test.each([
    { path: '/zh/products/crescent-ring', add: '加入购物车', text: '购物车内容过多，未能加入。请先从购物车中删除一些商品再试。' },
    {
      path: '/en/products/crescent-ring',
      add: 'Add to cart',
      text: 'Your cart has too much in it to add this. Remove something from your cart and try again.',
    },
  ])('$path says in its locale when the cart would be too large for its cookie', async ({ path, add, text }) => {
    const user = userEvent.setup();
    server.use(mockApi.cartAdd({ status: 409, body: { error: 'cart_too_large' } }));
    renderRoute(path);

    await user.click(await screen.findByRole('button', { name: add }));

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
  });

  test('when the size has just sold out, the page shows it once the API refuses', async () => {
    const user = userEvent.setup();
    const requests: Request[] = [];
    const soldOut: ProductPage = {
      ...crescentRing,
      product: {
        ...crescentRing.product,
        stockStatus: 'sold_out',
        variants: crescentRing.product.variants.map((variant) => ({ ...variant, stockStatus: 'sold_out' as const })),
      },
    };
    server.use(
      mockApi.cartAdd({ status: 409, body: { error: 'sold_out' } }, requests),
      mockApi.productPages(() => ({ 'crescent-ring': requests.length > 0 ? soldOut : crescentRing })),
    );
    renderRoute('/products/crescent-ring');

    await user.click(await screen.findByRole('button', { name: 'カートに入れる' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('この商品は売り切れました。');
    expect(await screen.findByText('SOLD OUT')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'カートに入れる' })).toBeDisabled();
  });

  test('when the request fails, or the API no longer knows the product, says it could not be added', async () => {
    const user = userEvent.setup();
    server.use(mockApi.cartAdd({ status: 404, body: { error: 'not_found' } }), mockApi.cartAddUnreachable());
    renderRoute('/products/crescent-ring');

    const add = await screen.findByRole('button', { name: 'カートに入れる' });
    const failed = 'カートに追加できませんでした。時間をおいて、もう一度お試しください。';
    await user.click(add);
    expect(await screen.findByRole('alert')).toHaveTextContent(failed);

    await user.click(add);
    expect(await screen.findByRole('alert')).toHaveTextContent(failed);
  });

  test('a product whose every size is sold out cannot be added', async () => {
    renderRoute('/products/pearl-earrings');

    expect(await screen.findByRole('button', { name: 'カートに入れる' })).toBeDisabled();
    const quantity = screen.getByRole('group', { name: '数量' });
    for (const button of within(quantity).getAllByRole('button')) expect(button).toBeDisabled();
  });

  test('in English, the size goes into the cart in English and the header counts it', async () => {
    const user = userEvent.setup();
    const requests: Request[] = [];
    const cartWithOne = { ...cartWithThree, quantity: 1 };
    server.use(
      mockApi.cartAdd({ status: 200, body: cartWithOne }, requests),
      mockApi.cart(() => (requests.length > 0 ? cartWithOne : emptyCart)),
    );
    renderRoute('/en/products/crescent-ring');

    await user.click(await screen.findByRole('button', { name: 'Add to cart' }));

    const done = await screen.findByRole('status');
    expect(done).toHaveTextContent('Added to your cart.');
    expect(within(done).getByRole('link', { name: 'View cart' })).toHaveAttribute('href', '/en/cart');
    expect(new URL(requests[0]?.url ?? '').searchParams.get('locale')).toBe('en');
    expect(await requests[0]?.json()).toEqual({ productSlug: 'crescent-ring', sku: '7', quantity: 1 });
    expect(await within(screen.getByRole('banner')).findByRole('link', { name: 'Cart (1 item)' })).toBeInTheDocument();
  });
});
