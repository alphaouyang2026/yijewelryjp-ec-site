import { assert, beforeEach, describe, expect, test } from 'vitest';
import { checkedOut, deliver, type Client, type Locale } from './support/shopping';
import { useTestApi } from './support/test-api';

// The order page: the link in the order confirmation email takes the
// customer to it, with the order's token; no account, no sign-in.

function orderPage(client: Client, order: string, token: string, locale: Locale = 'ja') {
  return client.api.orders[':orderId'].$get({ param: { orderId: order }, query: { token, locale } });
}

describe('the order page', () => {
  const api = useTestApi();

  beforeEach(async () => {
    await api.seed.catalog.products([
      {
        slug: 'moon-ring',
        name: { ja: '月のリング', en: 'Moon ring' },
        variants: [{ sku: 'moon-ring-9', label: { ja: '9号', en: 'Size 9' }, priceYen: 9_000, onHandStock: 5 }],
      },
      {
        slug: 'star-necklace',
        name: { ja: '星のネックレス' },
        variants: [{ sku: 'star-45', label: { ja: '45cm' }, priceYen: 4_000, onHandStock: 5 }],
      },
    ]);
  });

  test('shows the paid order: its lines, amounts with the tax included, and where it ships, in the page’s locale', async () => {
    const { order, token, session } = await checkedOut(api, {
      lines: [
        ['moon-ring', 'moon-ring-9', 1],
        ['star-necklace', 'star-45', 2],
      ],
    });
    await deliver(api, api.payments.pay(session.id));

    // The order was placed in Japanese; the page is in the locale of its URL.
    const res = await orderPage(api.client(), order, token, 'en');

    assert(res.status === 200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({
      orderNumber: order,
      status: 'paid',
      placedAt: '2025-12-31T15:00:00.000Z',
      lines: [
        { name: 'Moon ring', variantLabel: 'Size 9', unitPriceYen: 9_000, quantity: 1, lineAmountYen: 9_000 },
        { name: '星のネックレス', variantLabel: '45cm', unitPriceYen: 4_000, quantity: 2, lineAmountYen: 8_000 },
      ],
      subtotalYen: 17_000,
      shippingYen: 800,
      totalYen: 17_800,
      // floor(17,800 × 10 / 110) = floor(1,618.1…)
      taxYen: 1_618,
      shippingAddress: {
        name: '山田 花子',
        postalCode: '150-0001',
        prefecture: '東京都',
        city: '渋谷区',
        line1: '神宮前1-2-3',
        line2: 'ジュエリービル 401',
      },
    });
  });

  test('before the payment is confirmed, the order has no address yet', async () => {
    const { order, token } = await checkedOut(api);

    const res = await orderPage(api.client(), order, token);

    assert(res.status === 200);
    expect(await res.json()).toMatchObject({ status: 'pending_payment', shippingAddress: null });
  });

  test('another token, or none, or an order number no order has, finds no order', async () => {
    const { order, token } = await checkedOut(api);

    for (const [number, sent] of [
      [order, 'not-the-token'],
      [order, ''],
      ['20260101000000-0000', token],
    ] as const) {
      const res = await orderPage(api.client(), number, sent);

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'not_found' });
    }
    expect((await api.request(`/api/orders/${order}?locale=ja`)).status).toBe(404);
  });
});
