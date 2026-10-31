import { assert, beforeEach, describe, expect, test } from 'vitest';
import { checkedOut, checkout, fill, orderLookup, reservedStock, type Client } from './support/shopping';
import { useTestApi } from './support/test-api';

// The amounts below are at the test API's shipping rates (TEST_SHIPPING_RATES):
// a fee of ¥800, and free shipping from a subtotal of ¥20,000.

/** An order number: when it was placed in Japan (yyyyMMddHHmmss), and 4 random letters or digits. */
const ORDER_NUMBER = /^\d{14}-[0-9A-HJKMNP-TV-Z]{4}$/;

describe('starting checkout', () => {
  const api = useTestApi();

  beforeEach(async () => {
    await api.seed.catalog.products([
      {
        slug: 'moon-ring',
        name: { ja: '月のリング', zh: '月亮戒指' },
        variants: [{ sku: 'moon-ring-9', label: { ja: '9号', zh: '9号' }, priceYen: 9_000, onHandStock: 3 }],
      },
      {
        slug: 'star-necklace',
        name: { ja: '星のネックレス' },
        variants: [{ sku: 'star-45', label: { ja: '45cm' }, priceYen: 4_000, onHandStock: 5 }],
      },
    ]);
  });

  test('creates the payment page for the cart, in the customer’s locale, and answers with its URL', async () => {
    const client = api.client();
    await fill(client, ['moon-ring', 'moon-ring-9', 1], ['star-necklace', 'star-45', 2]);

    const res = await checkout(client, 'zh');

    assert(res.status === 200);
    const session = api.payments.sessions.at(-1);
    assert(session);
    expect(await res.json()).toEqual({ url: session.url });
    expect(session.request).toEqual({
      orderId: expect.stringMatching(ORDER_NUMBER),
      locale: 'zh',
      lines: [
        { name: '月亮戒指', variantLabel: '9号', unitPrice: { yen: 9_000 }, quantity: 1 },
        { name: '星のネックレス', variantLabel: '45cm', unitPrice: { yen: 4_000 }, quantity: 2 },
      ],
      // A subtotal of ¥17,000: short of free shipping.
      shippingFee: { yen: 800 },
      successUrl: expect.stringMatching(/^https:\/\/shop\.test\/zh\/checkout\/complete\?order=[^&]+&token=[\w-]+$/),
      cancelUrl: expect.stringMatching(/^https:\/\/shop\.test\/zh\/checkout\/cancelled\?order=[^&]+&token=[\w-]+$/),
      // Stripe lets a session expire no sooner than 30 minutes after it creates it.
      expiresAt: new Date('2026-01-01T00:31:00+09:00'),
    });
    expect(session.request.successUrl).toContain(`order=${session.request.orderId}&`);
  });

  test('reserves the stock: other customers can have only what is left, and the admin shows it reserved', async () => {
    const customer = api.client();
    await fill(customer, ['moon-ring', 'moon-ring-9', 2]);

    expect((await checkout(customer)).status).toBe(200);

    const other = await api.client().api.cart.lines.$post({
      query: { locale: 'ja' },
      json: { productSlug: 'moon-ring', sku: 'moon-ring-9', quantity: 2 },
    });
    expect(other.status).toBe(409);
    expect(await other.json()).toEqual({ error: 'exceeds_available', availableStock: 1 });
    expect(await reservedStock(api, 'moon-ring')).toEqual({ 'moon-ring-9': 2 });
  });

  test('leaves the cart as it was: the customer still has it while they pay', async () => {
    const client = api.client();
    await fill(client, ['moon-ring', 'moon-ring-9', 1]);

    const res = await checkout(client);

    expect(res.headers.getSetCookie()).toEqual([]);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const cart = await client.api.cart.$get({ query: { locale: 'ja' } });
    assert(cart.status === 200);
    expect((await cart.json()).lines.map((line) => [line.sku, line.quantity])).toEqual([['moon-ring-9', 1]]);
  });
});

describe('the thank-you page’s order', () => {
  const api = useTestApi();

  beforeEach(async () => {
    await api.seed.catalog.products([{ slug: 'moon-ring', variants: [{ sku: 'moon-ring-9' }] }]);
  });

  test('the page the customer returns to after paying finds the order; until the payment is confirmed it is pending', async () => {
    const { order, token } = await checkedOut(api);

    const res = await orderLookup(api.client(), order, token);

    assert(res.status === 200);
    expect(await res.json()).toEqual({ orderNumber: order, status: 'pending_payment' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  test('another token, or none, finds no order', async () => {
    const { order } = await checkedOut(api);

    for (const token of ['not-the-token', '']) {
      const res = await orderLookup(api.client(), order, token);

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'not_found' });
    }
    expect((await api.request(`/api/checkout/orders/${order}`)).status).toBe(404);
  });

  test('an order number no order has finds none', async () => {
    const { token } = await checkedOut(api);

    expect((await orderLookup(api.client(), '20260101000000-0000', token)).status).toBe(404);
  });
});

describe('leaving the payment page without paying', () => {
  const api = useTestApi();

  beforeEach(async () => {
    await api.seed.catalog.products([{ slug: 'moon-ring', variants: [{ sku: 'moon-ring-9', onHandStock: 1 }] }]);
  });

  test('cancels the checkout: the payment page can no longer be paid, the stock is released, the cart stays', async () => {
    const { client, order, token, session } = await checkedOut(api);

    const res = await cancel(client, order, token);

    expect(res.status).toBe(204);
    expect(session.status).toBe('expired');
    expect(await reservedStock(api, 'moon-ring')).toEqual({ 'moon-ring-9': 0 });
    expect(await (await orderLookup(client, order, token)).json()).toEqual({ orderNumber: order, status: 'expired' });
    // The customer's own cart shows the ring buyable again, and they can check it out once more.
    const cart = await client.api.cart.$get({ query: { locale: 'ja' } });
    assert(cart.status === 200);
    expect((await cart.json()).lines.map((line) => [line.sku, line.available])).toEqual([['moon-ring-9', true]]);
    expect((await checkout(client)).status).toBe(200);
  });

  test('cancelling again changes nothing', async () => {
    const { client, order, token } = await checkedOut(api);
    await cancel(client, order, token);
    const second = await checkedOut(api);

    const res = await cancel(client, order, token);

    expect(res.status).toBe(204);
    // The ring is reserved again, by the second checkout; cancelling the first does not release it.
    expect(second.session.status).toBe('open');
    expect(await reservedStock(api, 'moon-ring')).toEqual({ 'moon-ring-9': 1 });
  });

  test('a checkout already paid is not cancelled: its stock stays reserved for the order', async () => {
    const { client, order, token, session } = await checkedOut(api);
    api.payments.complete(session.id);

    const res = await cancel(client, order, token);

    expect(res.status).toBe(204);
    expect(await reservedStock(api, 'moon-ring')).toEqual({ 'moon-ring-9': 1 });
    expect(await (await orderLookup(client, order, token)).json()).toEqual({
      orderNumber: order,
      status: 'pending_payment',
    });
  });

  test('when the payment service cannot end the session, nothing is released: the customer might still pay', async () => {
    const { client, order, token, session } = await checkedOut(api);
    api.payments.failNextExpire();

    const res = await cancel(client, order, token);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'payment_unavailable' });
    expect(session.status).toBe('open');
    expect(await reservedStock(api, 'moon-ring')).toEqual({ 'moon-ring-9': 1 });
  });

  test('another token cancels nothing', async () => {
    const { client, order, session } = await checkedOut(api);

    const res = await cancel(client, order, 'not-the-token');

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    expect(session.status).toBe('open');
    expect(await reservedStock(api, 'moon-ring')).toEqual({ 'moon-ring-9': 1 });
  });

  test('the token must come as JSON', async () => {
    const { order, token } = await checkedOut(api);

    const res = await api.request(`/api/checkout/orders/${order}/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    });

    expect(res.status).toBe(400);
    expect(await reservedStock(api, 'moon-ring')).toEqual({ 'moon-ring-9': 1 });
  });
});

function cancel(client: Client, order: string, token: string) {
  return client.api.checkout.orders[':orderId'].cancel.$post({ param: { orderId: order }, json: { token } });
}

describe('checkouts at the same time', () => {
  const api = useTestApi();

  test('two customers checking out the last one at once: exactly one gets it', async () => {
    await api.seed.catalog.products([{ slug: 'last-ring', variants: [{ sku: 'last-ring-9', onHandStock: 1 }] }]);
    const customers = [api.client(), api.client()];
    for (const customer of customers) await fill(customer, ['last-ring', 'last-ring-9', 1]);

    const answers = await Promise.all(customers.map((customer) => checkout(customer)));

    expect(answers.map((res) => res.status).sort()).toEqual([200, 409]);
    const refused = answers.find((res) => res.status === 409);
    expect(await refused?.json()).toMatchObject({ error: 'unavailable_lines', lines: [{ availableStock: 0 }] });
    expect(api.payments.sessions).toHaveLength(1);
    expect(await reservedStock(api, 'last-ring')).toEqual({ 'last-ring-9': 1 });
  });

  test('many customers at once, each for one of a few: as many succeed as there are', async () => {
    await api.seed.catalog.products([{ slug: 'few-rings', variants: [{ sku: 'few-rings-9', onHandStock: 3 }] }]);
    const customers = Array.from({ length: 6 }, () => api.client());
    for (const customer of customers) await fill(customer, ['few-rings', 'few-rings-9', 1]);

    const answers = await Promise.all(customers.map((customer) => checkout(customer)));

    // A checkout that kept colliding with the others may give up (503) rather than be refused; none oversells.
    const statuses = answers.map((res) => res.status);
    expect(statuses.filter((status) => status === 200)).toHaveLength(3);
    expect(await reservedStock(api, 'few-rings')).toEqual({ 'few-rings-9': 3 });
  });

  test('reserves two variants of one product together', async () => {
    await api.seed.catalog.products([
      {
        slug: 'pair-ring',
        variants: [
          { sku: 'pair-ring-9', onHandStock: 2 },
          { sku: 'pair-ring-11', onHandStock: 2 },
        ],
      },
    ]);
    const client = api.client();
    await fill(client, ['pair-ring', 'pair-ring-9', 1], ['pair-ring', 'pair-ring-11', 2]);

    expect((await checkout(client)).status).toBe(200);

    expect(await reservedStock(api, 'pair-ring')).toEqual({ 'pair-ring-9': 1, 'pair-ring-11': 2 });
  });
});

describe('checkout refused', () => {
  const api = useTestApi();

  beforeEach(async () => {
    await api.seed.catalog.products([
      {
        slug: 'moon-ring',
        name: { ja: '月のリング' },
        variants: [{ sku: 'moon-ring-9', label: { ja: '9号' }, onHandStock: 3 }],
      },
      {
        slug: 'star-necklace',
        name: { ja: '星のネックレス' },
        variants: [{ sku: 'star-45', label: { ja: '45cm' }, onHandStock: 5 }],
      },
    ]);
  });

  test('a line with fewer available than it has fails the whole checkout, naming the line; nothing is reserved', async () => {
    const client = api.client();
    await fill(client, ['moon-ring', 'moon-ring-9', 1], ['star-necklace', 'star-45', 2]);
    // Meanwhile, other checkouts reserve all but one of the necklaces.
    await api.seed.catalog.products([
      {
        slug: 'star-necklace',
        name: { ja: '星のネックレス' },
        variants: [{ sku: 'star-45', label: { ja: '45cm' }, onHandStock: 5, reservedStock: 4 }],
      },
    ]);

    const res = await checkout(client);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'unavailable_lines',
      lines: [
        { lineId: lineId('star-necklace', 'star-45'), name: '星のネックレス', variantLabel: '45cm', availableStock: 1 },
      ],
    });
    expect(api.payments.sessions).toEqual([]);
    expect(await reservedStock(api, 'moon-ring')).toEqual({ 'moon-ring-9': 0 });
  });

  test('a line whose product is no longer on sale fails the checkout: none of it can be bought', async () => {
    const client = api.client();
    await fill(client, ['moon-ring', 'moon-ring-9', 1]);
    await api.seed.catalog.products([
      {
        slug: 'moon-ring',
        status: 'archived',
        name: { ja: '月のリング' },
        variants: [{ sku: 'moon-ring-9', label: { ja: '9号' } }],
      },
    ]);

    const res = await checkout(client);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'unavailable_lines',
      lines: [
        { lineId: lineId('moon-ring', 'moon-ring-9'), name: '月のリング', variantLabel: '9号', availableStock: 0 },
      ],
    });
  });

  test('a line whose product no longer has its variant fails the checkout', async () => {
    const client = api.client();
    await fill(client, ['moon-ring', 'moon-ring-9', 1]);
    await api.seed.catalog.products([
      { slug: 'moon-ring', name: { ja: '月のリング' }, variants: [{ sku: 'moon-ring-11' }] },
    ]);

    const res = await checkout(client);

    expect(await res.json()).toEqual({
      error: 'unavailable_lines',
      lines: [
        { lineId: lineId('moon-ring', 'moon-ring-9'), name: '月のリング', variantLabel: null, availableStock: 0 },
      ],
    });
  });

  test('names the refused lines in the requested locale', async () => {
    const client = api.client();
    await fill(client, ['moon-ring', 'moon-ring-9', 1]);
    await api.seed.catalog.products([
      {
        slug: 'moon-ring',
        status: 'draft',
        name: { ja: '月のリング', en: 'Moon ring' },
        variants: [{ sku: 'moon-ring-9', label: { ja: '9号', en: 'Size 9' } }],
      },
    ]);

    const res = await checkout(client, 'en');

    expect(await res.json()).toMatchObject({
      lines: [{ name: 'Moon ring', variantLabel: 'Size 9', availableStock: 0 }],
    });
  });

  test('an empty cart has nothing to check out', async () => {
    const res = await checkout(api.client());

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'cart_empty' });
    expect(api.payments.sessions).toEqual([]);
  });

  test('when the payment service fails, the stock is released at once and the customer can try again', async () => {
    const client = api.client();
    await fill(client, ['moon-ring', 'moon-ring-9', 2]);
    api.payments.failNextCreate();

    const res = await checkout(client);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'payment_unavailable' });
    expect(await reservedStock(api, 'moon-ring')).toEqual({ 'moon-ring-9': 0 });
    expect((await checkout(client)).status).toBe(200);
    expect(await reservedStock(api, 'moon-ring')).toEqual({ 'moon-ring-9': 2 });
  });

  test('needs a supported locale', async () => {
    for (const query of ['', '?locale=fr']) {
      const res = await api.request(`/api/checkout${query}`, { method: 'POST' });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'unsupported_locale', supportedLocales: ['ja', 'zh', 'en'] });
    }
  });
});

/** The id a cart line has in the cart's routes: its slug and SKU, in base64url. */
const lineId = (productSlug: string, sku: string) => Buffer.from(`${productSlug}/${sku}`).toString('base64url');
