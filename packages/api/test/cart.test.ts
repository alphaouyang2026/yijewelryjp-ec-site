import { assert, beforeAll, describe, expect, test } from 'vitest';
import { TEST_SHIPPING_RATES, useTestApi } from './support/test-api';

// The amounts below are at the test API's shipping rates (TEST_SHIPPING_RATES):
// a fee of ¥800, and free shipping from a subtotal of ¥20,000.

type Locale = 'ja' | 'zh' | 'en';
type Client = ReturnType<ReturnType<typeof useTestApi>['client']>;

const EMPTY_CART = {
  lines: [],
  itemCount: 0,
  subtotalYen: 0,
  shippingYen: 0,
  totalYen: 0,
  freeShippingThresholdYen: TEST_SHIPPING_RATES.freeShippingThreshold.yen,
  freeShippingRemainingYen: TEST_SHIPPING_RATES.freeShippingThreshold.yen,
  maxLines: 20,
};

/** The id a cart line has in the cart's routes: its slug and SKU, in base64url. */
const lineId = (productSlug: string, sku: string) => Buffer.from(`${productSlug}/${sku}`).toString('base64url');

function add(client: Client, productSlug: string, sku: string, quantity = 1, locale: Locale = 'ja') {
  return client.api.cart.lines.$post({ query: { locale }, json: { productSlug, sku, quantity } });
}

function setQuantity(client: Client, id: string, quantity: number) {
  return client.api.cart.lines[':lineId'].$put({ param: { lineId: id }, query: { locale: 'ja' }, json: { quantity } });
}

function remove(client: Client, id: string) {
  return client.api.cart.lines[':lineId'].$delete({ param: { lineId: id }, query: { locale: 'ja' } });
}

async function cartOf(client: Client, locale: Locale = 'ja') {
  const res = await client.api.cart.$get({ query: { locale } });
  assert(res.status === 200);
  return res.json();
}

type CartBody = Awaited<ReturnType<typeof cartOf>>;

/** The cart a raw request's response answers with. */
async function cartIn(response: Response): Promise<CartBody> {
  expect(response.status).toBe(200);
  return (await response.json()) as CartBody;
}

/** Adds each [slug, sku, quantity] to the cart, expecting each to succeed. */
async function fill(client: Client, ...lines: [string, string, number][]) {
  for (const [slug, sku, quantity] of lines) {
    const res = await add(client, slug, sku, quantity);
    expect(res.status).toBe(200);
  }
}

/** The Set-Cookie header `response` sets the cart cookie with, if any. */
function cartSetCookie(response: Response): string | undefined {
  return response.headers.getSetCookie().find((cookie) => cookie.startsWith('__Host-yi_cart='));
}

/** The value of the cart cookie `response` sets. */
function cartCookieValue(response: Response): string {
  const cookie = cartSetCookie(response);
  if (!cookie) throw new Error('Expected the response to set the cart cookie');
  return cookie.slice('__Host-yi_cart='.length).split(';')[0] ?? '';
}

describe('viewing the cart', () => {
  const api = useTestApi();

  test('a customer without a cart has an empty one; viewing it sets no cookie and is not cached', async () => {
    const res = await api.client().api.cart.$get({ query: { locale: 'ja' } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(EMPTY_CART);
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  test('viewing a cart with lines does not set the cookie again', async () => {
    await api.seed.catalog.products([{ slug: 'view-ring' }]);
    const client = api.client();
    await fill(client, ['view-ring', 'view-ring-1', 1]);

    const res = await client.api.cart.$get({ query: { locale: 'ja' } });

    expect(res.headers.getSetCookie()).toEqual([]);
  });

  test.each([
    { route: 'GET /api/cart', method: 'GET', path: '/api/cart' },
    { route: 'POST /api/cart/lines', method: 'POST', path: '/api/cart/lines' },
    { route: 'PUT /api/cart/lines/:lineId', method: 'PUT', path: `/api/cart/lines/${lineId('a', 'b')}` },
    { route: 'DELETE /api/cart/lines/:lineId', method: 'DELETE', path: `/api/cart/lines/${lineId('a', 'b')}` },
  ])('$route needs a supported locale', async ({ method, path }) => {
    const init = { method, headers: { 'content-type': 'application/json' }, body: method === 'GET' ? undefined : '{}' };
    for (const query of ['', '?locale=fr']) {
      const res = await api.request(`${path}${query}`, init);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'unsupported_locale', supportedLocales: ['ja', 'zh', 'en'] });
    }
  });
});

describe('adding to the cart', () => {
  const api = useTestApi();

  beforeAll(async () => {
    await api.seed.catalog.products([
      {
        slug: 'moon-ring',
        name: { ja: '月のリング' },
        photos: [{ key: 'images/products/moon.jpg', alt: { ja: '月のリングの写真' } }],
        variants: [
          { sku: 'moon-ring-9', label: { ja: '9号' }, priceYen: 24_000, onHandStock: 3 },
          { sku: 'moon-ring-11', label: { ja: '11号' }, priceYen: 25_000, onHandStock: 5, reservedStock: 3 },
          { sku: 'moon-ring-13', label: { ja: '13号' }, priceYen: 25_000, onHandStock: 2, reservedStock: 2 },
        ],
      },
      { slug: 'star-necklace', name: { ja: '星のネックレス' }, variants: [{ priceYen: 8_000 }] },
      { slug: 'draft-ring', status: 'draft' },
      { slug: 'archived-ring', status: 'archived' },
    ]);
  });

  test('adds the variant and keeps the cart in a signed, HTTP-only cookie for 30 days', async () => {
    const res = await add(api.client(), 'moon-ring', 'moon-ring-9', 2);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      lines: [
        {
          lineId: lineId('moon-ring', 'moon-ring-9'),
          productSlug: 'moon-ring',
          sku: 'moon-ring-9',
          name: '月のリング',
          variantLabel: '9号',
          photo: { url: '/images/products/moon.jpg', alt: '月のリングの写真' },
          priceYen: 24_000,
          quantity: 2,
          maxQuantity: 3,
          lineTotalYen: 48_000,
          available: true,
          notices: [],
        },
      ],
      itemCount: 2,
      subtotalYen: 48_000,
      shippingYen: 0,
      totalYen: 48_000,
      freeShippingThresholdYen: 20_000,
      freeShippingRemainingYen: 0,
      maxLines: 20,
    });
    const cookie = cartSetCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toContain('; Max-Age=2592000');
    expect(cookie).toContain('; Path=/');
    expect(cookie).toContain('; HttpOnly');
    expect(cookie).toContain('; Secure');
    expect(cookie).toContain('; SameSite=Lax');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  test('the cart is kept: viewing it again shows what was added', async () => {
    const client = api.client();
    await fill(client, ['moon-ring', 'moon-ring-9', 1]);

    const cart = await cartOf(client);

    expect(cart.lines.map((line) => [line.sku, line.quantity])).toEqual([['moon-ring-9', 1]]);
    expect(cart.itemCount).toBe(1);
  });

  test('adding a variant already in the cart adds to its line, which keeps its place', async () => {
    const client = api.client();
    await fill(client, ['moon-ring', 'moon-ring-9', 1], ['star-necklace', 'star-necklace-1', 1]);

    const res = await add(client, 'moon-ring', 'moon-ring-9', 2);

    assert(res.status === 200);
    const cart = await res.json();
    expect(cart.lines.map((line) => [line.sku, line.quantity])).toEqual([
      ['moon-ring-9', 3],
      ['star-necklace-1', 1],
    ]);
    expect(cart.itemCount).toBe(4);
  });

  test('more than the available stock is refused, counting what the cart has, and the cart stays as it was', async () => {
    const client = api.client();
    await fill(client, ['moon-ring', 'moon-ring-9', 2]);

    const res = await add(client, 'moon-ring', 'moon-ring-9', 2);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'exceeds_available', availableStock: 3 });
    expect(cartSetCookie(res)).toBeUndefined();
    expect((await cartOf(client)).lines.map((line) => line.quantity)).toEqual([2]);
  });

  test('reserved stock is not available', async () => {
    const res = await add(api.client(), 'moon-ring', 'moon-ring-11', 3);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'exceeds_available', availableStock: 2 });
  });

  test('a sold-out variant is refused', async () => {
    const client = api.client();

    const res = await add(client, 'moon-ring', 'moon-ring-13');

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'sold_out' });
    expect(cartSetCookie(res)).toBeUndefined();
    expect(await cartOf(client)).toEqual(EMPTY_CART);
  });

  test.each([
    { case: 'a draft', slug: 'draft-ring', sku: 'draft-ring-1' },
    { case: 'an archived product', slug: 'archived-ring', sku: 'archived-ring-1' },
    { case: 'a product that does not exist', slug: 'no-such-ring', sku: 'no-such-ring-1' },
    { case: 'a SKU the product does not have', slug: 'moon-ring', sku: 'moon-ring-15' },
    { case: "another product's SKU", slug: 'moon-ring', sku: 'star-necklace-1' },
  ])('$case is not found', async ({ slug, sku }) => {
    const client = api.client();

    const res = await add(client, slug, sku);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    expect(cartSetCookie(res)).toBeUndefined();
  });

  test.each([
    { case: 'a quantity of 0', json: { productSlug: 'moon-ring', sku: 'moon-ring-9', quantity: 0 }, path: 'quantity', code: 'invalid' },
    { case: 'a fractional quantity', json: { productSlug: 'moon-ring', sku: 'moon-ring-9', quantity: 1.5 }, path: 'quantity', code: 'invalid' },
    { case: 'a quantity as text', json: { productSlug: 'moon-ring', sku: 'moon-ring-9', quantity: '1' }, path: 'quantity', code: 'invalid' },
    { case: 'no quantity', json: { productSlug: 'moon-ring', sku: 'moon-ring-9' }, path: 'quantity', code: 'required' },
    { case: 'no SKU', json: { productSlug: 'moon-ring', quantity: 1 }, path: 'sku', code: 'required' },
    { case: 'a blank slug', json: { productSlug: '', sku: 'moon-ring-9', quantity: 1 }, path: 'productSlug', code: 'required' },
  ])('$case is invalid', async ({ json, path, code }) => {
    const res = await api.request('/api/cart/lines?locale=ja', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(json),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_input', fields: [{ path, code }] });
    expect(cartSetCookie(res)).toBeUndefined();
  });

  // What a form on another site can send without a CORS preflight.
  test.each([
    { contentType: 'text/plain', body: JSON.stringify({ productSlug: 'moon-ring', sku: 'moon-ring-9', quantity: 1 }) },
    { contentType: 'application/x-www-form-urlencoded', body: 'productSlug=moon-ring&sku=moon-ring-9&quantity=1' },
  ])('a body sent as $contentType is refused', async ({ contentType, body }) => {
    const res = await api.request('/api/cart/lines?locale=ja', {
      method: 'POST',
      headers: { 'content-type': contentType },
      body,
    });

    expect(res.status).toBe(400);
    expect(cartSetCookie(res)).toBeUndefined();
  });
});

describe('the most lines a cart holds', () => {
  const api = useTestApi();
  const slugs = Array.from({ length: 21 }, (_, index) => `ring-${index + 1}`);

  beforeAll(async () => {
    await api.seed.catalog.products(slugs.map((slug) => ({ slug, variants: [{ priceYen: 1_000 }] })));
  });

  test('a cart holds 20 lines; a 21st is refused, but adding to a line it has is not', async () => {
    const client = api.client();
    await fill(client, ...slugs.slice(0, 20).map((slug): [string, string, number] => [slug, `${slug}-1`, 1]));
    expect((await cartOf(client)).lines).toHaveLength(20);

    const full = await add(client, 'ring-21', 'ring-21-1');

    expect(full.status).toBe(409);
    expect(await full.json()).toEqual({ error: 'cart_full', maxLines: 20 });
    expect(cartSetCookie(full)).toBeUndefined();
    expect((await cartOf(client)).lines).toHaveLength(20);

    const more = await add(client, 'ring-1', 'ring-1-1');

    assert(more.status === 200);
    const cart = await more.json();
    expect(cart.lines).toHaveLength(20);
    expect(cart.lines[0]?.quantity).toBe(2);
  });
});

describe('a cart too large for its cookie', () => {
  const api = useTestApi();
  // The longest slug and SKU, in Japanese: each character takes 9 bytes in the cookie.
  const longSku = (index: number) => `${'指輪'.repeat(31)}${String(index).padStart(2, '0')}`;
  const products = Array.from({ length: 20 }, (_, index) => ({
    slug: `long-ring-${String(index + 1).padStart(2, '0')}-${'a'.repeat(67)}`,
    variants: [{ sku: longSku(index + 1) }],
  }));

  beforeAll(async () => {
    await api.seed.catalog.products(products);
  });

  test('adding a line that would make the cookie too large for browsers is refused as a full cart', async () => {
    const client = api.client();
    let refused: Response | undefined;
    for (const product of products) {
      const res = await add(client, product.slug, product.variants[0]!.sku);
      if (res.status !== 200) {
        refused = res;
        break;
      }
      expect(cartCookieValue(res).length + '__Host-yi_cart='.length).toBeLessThanOrEqual(4000);
    }

    assert(refused, 'Expected a line to be refused before the cart had 20');
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: 'cart_full', maxLines: 20 });
    expect(cartSetCookie(refused)).toBeUndefined();
    const cart = await cartOf(client);
    expect(cart.lines.length).toBeGreaterThan(0);
    expect(cart.lines.length).toBeLessThan(20);
  });
});

describe('changing a line’s quantity', () => {
  const api = useTestApi();

  beforeAll(async () => {
    await api.seed.catalog.products([
      { slug: 'moon-ring', variants: [{ priceYen: 5_000, onHandStock: 4 }] },
      { slug: 'star-necklace', variants: [{ priceYen: 3_000 }] },
    ]);
  });

  test('sets the quantity, and the amounts follow', async () => {
    const client = api.client();
    await fill(client, ['moon-ring', 'moon-ring-1', 1], ['star-necklace', 'star-necklace-1', 1]);

    const res = await setQuantity(client, lineId('moon-ring', 'moon-ring-1'), 3);

    assert(res.status === 200);
    const cart = await res.json();
    expect(cart.lines.map((line) => [line.sku, line.quantity, line.lineTotalYen])).toEqual([
      ['moon-ring-1', 3, 15_000],
      ['star-necklace-1', 1, 3_000],
    ]);
    expect(cart).toMatchObject({ itemCount: 4, subtotalYen: 18_000, shippingYen: 800, totalYen: 18_800 });
    expect(cartSetCookie(res)).toContain('; Max-Age=2592000');
    expect((await cartOf(client)).itemCount).toBe(4);
  });

  test('the line id the cart gives names the line', async () => {
    const client = api.client();
    await fill(client, ['moon-ring', 'moon-ring-1', 1]);
    const [line] = (await cartOf(client)).lines;
    assert(line);

    const res = await setQuantity(client, line.lineId, 2);

    expect(res.status).toBe(200);
  });

  test('more than the available stock is refused, and the cart stays as it was', async () => {
    const client = api.client();
    await fill(client, ['moon-ring', 'moon-ring-1', 2]);

    const res = await setQuantity(client, lineId('moon-ring', 'moon-ring-1'), 5);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'exceeds_available', availableStock: 4 });
    expect(cartSetCookie(res)).toBeUndefined();
    expect((await cartOf(client)).lines.map((line) => line.quantity)).toEqual([2]);
  });

  test.each([
    { case: 'a line the cart does not have', id: lineId('star-necklace', 'star-necklace-1') },
    { case: 'an id no line could have', id: 'not*an*id' },
    { case: 'an id without a SKU', id: Buffer.from('moon-ring').toString('base64url') },
  ])('$case is not in the cart', async ({ id }) => {
    const client = api.client();
    await fill(client, ['moon-ring', 'moon-ring-1', 1]);

    const res = await setQuantity(client, id, 1);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_in_cart' });
    expect(cartSetCookie(res)).toBeUndefined();
  });

  test.each([
    { case: '0 (removing is a DELETE)', quantity: 0 },
    { case: 'a negative quantity', quantity: -1 },
    { case: 'a fractional quantity', quantity: 0.5 },
  ])('$case is invalid', async ({ quantity }) => {
    const client = api.client();
    await fill(client, ['moon-ring', 'moon-ring-1', 1]);

    const res = await setQuantity(client, lineId('moon-ring', 'moon-ring-1'), quantity);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_input', fields: [{ path: 'quantity', code: 'invalid' }] });
  });
});

describe('removing a line', () => {
  const api = useTestApi();

  beforeAll(async () => {
    await api.seed.catalog.products([{ slug: 'moon-ring' }, { slug: 'star-necklace' }]);
  });

  test('removes the line and keeps the others', async () => {
    const client = api.client();
    await fill(client, ['moon-ring', 'moon-ring-1', 1], ['star-necklace', 'star-necklace-1', 2]);

    const res = await remove(client, lineId('moon-ring', 'moon-ring-1'));

    assert(res.status === 200);
    const cart = await res.json();
    expect(cart.lines.map((line) => line.sku)).toEqual(['star-necklace-1']);
    expect(cart.itemCount).toBe(2);
    expect((await cartOf(client)).lines.map((line) => line.sku)).toEqual(['star-necklace-1']);
  });

  test('removing the last line empties the cart and drops the cookie', async () => {
    const client = api.client();
    await fill(client, ['moon-ring', 'moon-ring-1', 1]);

    const res = await remove(client, lineId('moon-ring', 'moon-ring-1'));

    assert(res.status === 200);
    expect(await res.json()).toEqual(EMPTY_CART);
    expect(cartSetCookie(res)).toMatch(/^__Host-yi_cart=;.*Max-Age=0/);
    const after = await client.api.cart.$get({ query: { locale: 'ja' } });
    expect(await after.json()).toEqual(EMPTY_CART);
  });

  test.each([
    { case: 'a line the cart does not have', id: lineId('star-necklace', 'star-necklace-1') },
    { case: 'an id no line could have', id: 'not*an*id' },
  ])('removing $case changes nothing', async ({ id }) => {
    const client = api.client();
    await fill(client, ['moon-ring', 'moon-ring-1', 1]);

    const res = await remove(client, id);

    assert(res.status === 200);
    expect((await res.json()).lines.map((line) => line.sku)).toEqual(['moon-ring-1']);
    expect((await cartOf(client)).lines.map((line) => line.sku)).toEqual(['moon-ring-1']);
  });
});

describe('amounts and free shipping', () => {
  const api = useTestApi();

  beforeAll(async () => {
    await api.seed.catalog.products([
      { slug: 'small-ring', variants: [{ priceYen: 19_999 }] },
      { slug: 'half-ring', variants: [{ priceYen: 10_000 }] },
      { slug: 'one-yen-charm', variants: [{ priceYen: 1 }] },
    ]);
  });

  test('a subtotal ¥1 below the threshold pays the shipping fee, ¥1 short of free shipping', async () => {
    const res = await add(api.client(), 'small-ring', 'small-ring-1');

    assert(res.status === 200);
    expect(await res.json()).toMatchObject({
      subtotalYen: 19_999,
      shippingYen: 800,
      totalYen: 20_799,
      freeShippingThresholdYen: 20_000,
      freeShippingRemainingYen: 1,
    });
  });

  test('a subtotal of exactly the threshold ships free', async () => {
    const client = api.client();
    await fill(client, ['small-ring', 'small-ring-1', 1]);

    const res = await add(client, 'one-yen-charm', 'one-yen-charm-1');

    assert(res.status === 200);
    expect(await res.json()).toMatchObject({
      subtotalYen: 20_000,
      shippingYen: 0,
      totalYen: 20_000,
      freeShippingRemainingYen: 0,
    });
  });

  test('a subtotal over the threshold ships free', async () => {
    const res = await add(api.client(), 'half-ring', 'half-ring-1', 3);

    assert(res.status === 200);
    expect(await res.json()).toMatchObject({ subtotalYen: 30_000, shippingYen: 0, totalYen: 30_000, freeShippingRemainingYen: 0 });
  });

  test('an empty cart has nothing to ship', async () => {
    expect(await cartOf(api.client())).toMatchObject({ subtotalYen: 0, shippingYen: 0, totalYen: 0 });
  });
});

describe('checking the cart against the catalog', () => {
  const api = useTestApi();

  /** A new customer whose cart has `quantity` of the only variant of a new product `slug`, priced ¥10,000, 5 in stock. */
  async function customerWith(slug: string, quantity = 1) {
    await api.seed.catalog.products([{ slug, name: { ja: `${slug}の名前` }, variants: [{ label: { ja: '規格' } }] }]);
    const client = api.client();
    await fill(client, [slug, `${slug}-1`, quantity]);
    return client;
  }

  test('a line whose variant has sold out stays, marked, but counts in no amount', async () => {
    await api.seed.catalog.products([{ slug: 'other-ring', variants: [{ priceYen: 3_000 }] }]);
    const client = await customerWith('sold-ring', 2);
    await fill(client, ['other-ring', 'other-ring-1', 1]);
    // Every one left is held by checkouts in progress.
    await api.seed.catalog.products([{ slug: 'sold-ring', variants: [{ onHandStock: 1, reservedStock: 1 }] }]);

    const cart = await cartOf(client);

    expect(cart.lines[0]).toMatchObject({
      sku: 'sold-ring-1',
      priceYen: 10_000,
      quantity: 2,
      maxQuantity: 0,
      lineTotalYen: 0,
      available: false,
      notices: [{ code: 'sold_out' }],
    });
    expect(cart).toMatchObject({ itemCount: 3, subtotalYen: 3_000, shippingYen: 800, totalYen: 3_800 });
  });

  test.each([
    { case: 'made a draft again', product: { status: 'draft' as const } },
    { case: 'archived', product: { status: 'archived' as const } },
  ])('a line whose product was $case is marked unlisted and counts in no amount', async ({ product }) => {
    const slug = `unlisted-${product.status}`;
    const client = await customerWith(slug);
    await api.seed.catalog.products([{ slug, ...product, variants: [{ label: { ja: '規格' } }] }]);

    const cart = await cartOf(client);

    expect(cart.lines).toEqual([
      expect.objectContaining({
        name: `${slug}`,
        variantLabel: '規格',
        priceYen: 10_000,
        quantity: 1,
        maxQuantity: 0,
        lineTotalYen: 0,
        available: false,
        notices: [{ code: 'unlisted' }],
      }),
    ]);
    expect(cart).toMatchObject({ itemCount: 1, subtotalYen: 0, shippingYen: 0, totalYen: 0 });
  });

  test('a line whose variant the product no longer has is marked unlisted, at the price the customer saw', async () => {
    const client = await customerWith('resized-ring');
    await api.seed.catalog.products([{ slug: 'resized-ring', variants: [{ sku: 'resized-ring-2', priceYen: 12_000 }] }]);

    const cart = await cartOf(client);

    expect(cart.lines).toEqual([
      expect.objectContaining({
        sku: 'resized-ring-1',
        variantLabel: null,
        priceYen: 10_000,
        available: false,
        lineTotalYen: 0,
        notices: [{ code: 'unlisted' }],
      }),
    ]);
  });

  test('a sold-out or unlisted line’s quantity cannot be changed, but it can be removed', async () => {
    const client = await customerWith('gone-ring');
    await api.seed.catalog.products([{ slug: 'gone-ring', status: 'archived' }]);
    const id = lineId('gone-ring', 'gone-ring-1');

    const change = await setQuantity(client, id, 1);

    expect(change.status).toBe(409);
    expect(await change.json()).toEqual({ error: 'exceeds_available', availableStock: 0 });

    const removed = await remove(client, id);

    assert(removed.status === 200);
    expect((await removed.json()).lines).toEqual([]);
  });

  test('a line whose price changed shows the new price, counts it, and says what it was', async () => {
    const client = await customerWith('pricey-ring', 2);
    await api.seed.catalog.products([{ slug: 'pricey-ring', variants: [{ priceYen: 12_000 }] }]);

    const cart = await cartOf(client);

    expect(cart.lines[0]).toMatchObject({
      priceYen: 12_000,
      quantity: 2,
      lineTotalYen: 24_000,
      available: true,
      notices: [{ code: 'price_changed', previousPriceYen: 10_000 }],
    });
    expect(cart).toMatchObject({ subtotalYen: 24_000, totalYen: 24_000 });
    // Viewing the cart again does not make the notice go away.
    expect((await cartOf(client)).lines[0]?.notices).toEqual([{ code: 'price_changed', previousPriceYen: 10_000 }]);
  });

  test('setting the quantity of a line whose price changed accepts the new price', async () => {
    const client = await customerWith('accepted-ring');
    await api.seed.catalog.products([{ slug: 'accepted-ring', variants: [{ priceYen: 9_000 }] }]);

    const res = await setQuantity(client, lineId('accepted-ring', 'accepted-ring-1'), 1);

    assert(res.status === 200);
    expect((await res.json()).lines[0]).toMatchObject({ priceYen: 9_000, notices: [] });
    expect((await cartOf(client)).lines[0]?.notices).toEqual([]);
  });

  test('adding again a variant whose price changed accepts the new price', async () => {
    const client = await customerWith('readded-ring');
    await api.seed.catalog.products([{ slug: 'readded-ring', variants: [{ priceYen: 11_000 }] }]);

    const res = await add(client, 'readded-ring', 'readded-ring-1');

    assert(res.status === 200);
    expect((await res.json()).lines[0]).toMatchObject({ priceYen: 11_000, quantity: 2, notices: [] });
  });

  test('removing another line does not accept a changed price', async () => {
    await api.seed.catalog.products([{ slug: 'plain-ring' }]);
    const client = await customerWith('kept-notice-ring');
    await fill(client, ['plain-ring', 'plain-ring-1', 1]);
    await api.seed.catalog.products([{ slug: 'kept-notice-ring', variants: [{ priceYen: 11_000 }] }]);

    const res = await remove(client, lineId('plain-ring', 'plain-ring-1'));

    assert(res.status === 200);
    expect((await res.json()).lines[0]?.notices).toEqual([{ code: 'price_changed', previousPriceYen: 10_000 }]);
  });

  test('a line with more than is available now counts what is available, and says how many the customer wanted', async () => {
    const client = await customerWith('scarce-ring', 4);
    await api.seed.catalog.products([{ slug: 'scarce-ring', variants: [{ onHandStock: 3, reservedStock: 1 }] }]);

    const cart = await cartOf(client);

    expect(cart.lines[0]).toMatchObject({
      quantity: 2,
      maxQuantity: 2,
      lineTotalYen: 20_000,
      available: true,
      notices: [{ code: 'quantity_reduced', requestedQuantity: 4 }],
    });
    expect(cart).toMatchObject({ itemCount: 2, subtotalYen: 20_000 });

    // Adding counts what the cart counts, not what the customer wanted.
    const more = await add(client, 'scarce-ring', 'scarce-ring-1');
    expect(more.status).toBe(409);
    expect(await more.json()).toEqual({ error: 'exceeds_available', availableStock: 2 });
  });

  test('less stock and a changed price: both are said, the reduced quantity first', async () => {
    const client = await customerWith('changed-ring', 3);
    await api.seed.catalog.products([{ slug: 'changed-ring', variants: [{ priceYen: 8_000, onHandStock: 1 }] }]);

    const cart = await cartOf(client);

    expect(cart.lines[0]?.notices).toEqual([
      { code: 'quantity_reduced', requestedQuantity: 3 },
      { code: 'price_changed', previousPriceYen: 10_000 },
    ]);
    expect(cart.lines[0]).toMatchObject({ quantity: 1, lineTotalYen: 8_000 });
  });

  test('a line whose product no longer exists is left out, and dropped once the cart changes', async () => {
    await api.seed.catalog.products([{ slug: 'plain-necklace' }]);
    const signed = await api.request('/api/_test/cart-cookie', {
      method: 'POST',
      body: JSON.stringify({ v: 1, l: [['vanished-ring', 'vanished-ring-1', 1, 5_000], ['plain-necklace', 'plain-necklace-1', 1, 10_000]] }),
    });
    const cookie = `__Host-yi_cart=${cartCookieValue(signed)}`;

    const view = await api.request('/api/cart?locale=ja', { headers: { cookie } });

    expect((await cartIn(view)).lines).toEqual([expect.objectContaining({ sku: 'plain-necklace-1', notices: [] })]);

    const change = await api.request(`/api/cart/lines/${lineId('plain-necklace', 'plain-necklace-1')}?locale=ja`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ quantity: 2 }),
    });
    expect(change.status).toBe(200);
    const after = await api.request('/api/cart?locale=ja', {
      headers: { cookie: `__Host-yi_cart=${cartCookieValue(change)}` },
    });
    expect((await cartIn(after)).lines.map((line) => line.sku)).toEqual(['plain-necklace-1']);
  });
});

describe('the cart in each locale', () => {
  const api = useTestApi();

  beforeAll(async () => {
    await api.seed.catalog.products([
      {
        slug: 'moon-ring',
        name: { ja: '月のリング', zh: '月亮戒指', en: 'Moon Ring' },
        photos: [{ key: 'images/products/moon.jpg', alt: { ja: '月のリング', zh: '月亮戒指的照片' } }],
        variants: [{ label: { ja: '9号', en: 'Size 9' } }],
      },
    ]);
  });

  test.each([
    { locale: 'ja' as const, name: '月のリング', label: '9号', alt: '月のリング' },
    { locale: 'zh' as const, name: '月亮戒指', label: '9号', alt: '月亮戒指的照片' },
    { locale: 'en' as const, name: 'Moon Ring', label: 'Size 9', alt: '月のリング' },
  ])('in $locale, names, labels and alt text are in the locale, or Japanese without a translation', async ({ locale, name, label, alt }) => {
    const client = api.client();
    const added = await add(client, 'moon-ring', 'moon-ring-1', 1, locale);
    assert(added.status === 200);
    const expected = { name, variantLabel: label, photo: { url: '/images/products/moon.jpg', alt } };
    expect((await added.json()).lines[0]).toMatchObject(expected);

    expect((await cartOf(client, locale)).lines[0]).toMatchObject(expected);
  });
});

describe('a cart cookie the API did not issue as one is an empty cart', () => {
  const api = useTestApi();

  beforeAll(async () => {
    await api.seed.catalog.products([{ slug: 'moon-ring' }, { slug: 'star-necklace' }]);
  });

  async function viewWith(cookie: string) {
    return cartIn(await api.request('/api/cart?locale=ja', { headers: { cookie: `__Host-yi_cart=${cookie}` } }));
  }

  async function signedCartCookie(content: unknown) {
    const res = await api.request('/api/_test/cart-cookie', { method: 'POST', body: JSON.stringify(content) });
    return cartCookieValue(res);
  }

  test('a cart cookie with its content changed', async () => {
    const added = await add(api.client(), 'moon-ring', 'moon-ring-1', 1);
    const cookie = cartCookieValue(added);
    const tampered = cookie.replace('moon-ring-1%22%2C1', 'moon-ring-1%22%2C5');
    expect(tampered).not.toBe(cookie);

    expect(await viewWith(tampered)).toEqual(EMPTY_CART);
  });

  test('the owner’s session cookie, sent as the cart cookie', async () => {
    const signIn = await api.signIn(api.client());
    const session = signIn.headers.getSetCookie().find((cookie) => cookie.startsWith('__Host-yi_admin_session='));
    assert(session);

    expect(await viewWith(session.slice('__Host-yi_admin_session='.length).split(';')[0] ?? '')).toEqual(EMPTY_CART);
  });

  test('a cookie that is not signed', async () => {
    expect(await viewWith(encodeURIComponent(JSON.stringify({ v: 1, l: [['moon-ring', 'moon-ring-1', 1, 1]] })))).toEqual(
      EMPTY_CART,
    );
  });

  // Signed with the cart cookie's own key, as only someone who has the signing secret could: the API still checks the shape.
  const line = ['moon-ring', 'moon-ring-1', 1, 10_000];
  test.each([
    { case: 'another version', content: { v: 2, l: [line] } },
    { case: 'no lines', content: { v: 1 } },
    { case: 'a quantity of 0', content: { v: 1, l: [['moon-ring', 'moon-ring-1', 0, 10_000]] } },
    { case: 'a negative seen price', content: { v: 1, l: [['moon-ring', 'moon-ring-1', 1, -1]] } },
    { case: 'a line of three parts', content: { v: 1, l: [['moon-ring', 'moon-ring-1', 1]] } },
    { case: 'the same line twice', content: { v: 1, l: [line, line] } },
    { case: 'more than 20 lines', content: { v: 1, l: Array.from({ length: 21 }, (_, i) => ['moon-ring', `sku-${i}`, 1, 1]) } },
    { case: 'text instead of a cart', content: 'cart' },
    { case: 'nothing', content: null },
  ])('a cart cookie signed by the API, with $case', async ({ content }) => {
    expect(await viewWith(await signedCartCookie(content))).toEqual(EMPTY_CART);
  });

  test('a change to the cart starts from an empty cart and replaces the cookie', async () => {
    const forged = await signedCartCookie({ v: 2, l: [line] });

    const res = await api.request('/api/cart/lines?locale=ja', {
      method: 'POST',
      headers: { cookie: `__Host-yi_cart=${forged}`, 'content-type': 'application/json' },
      body: JSON.stringify({ productSlug: 'star-necklace', sku: 'star-necklace-1', quantity: 1 }),
    });

    expect((await cartIn(res)).lines.map((line) => line.sku)).toEqual(['star-necklace-1']);
    expect(await viewWith(cartCookieValue(res))).toMatchObject({ itemCount: 1 });
  });
});
