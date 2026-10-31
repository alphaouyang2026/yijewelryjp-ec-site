import { assert, beforeEach, describe, expect, test } from 'vitest';
import { checkedOut, deliver, fill, orderLookup, stock } from './support/shopping';
import { TEST_OWNER_NOTIFICATION_EMAIL, useTestApi } from './support/test-api';

describe('the payment service reports a checkout paid', () => {
  const api = useTestApi();

  beforeEach(async () => {
    await api.seed.catalog.products([{ slug: 'moon-ring', variants: [{ sku: 'moon-ring-9', onHandStock: 3 }] }]);
  });

  test('the order is paid: the thank-you page shows it', async () => {
    const { order, token, session } = await checkedOut(api);

    const res = await deliver(api, api.payments.pay(session.id));

    expect(res.status).toBe(200);
    expect(await (await orderLookup(api.client(), order, token)).json()).toEqual({
      orderNumber: order,
      status: 'paid',
    });
  });

  test('the reserved stock is sold: on-hand and reserved stock both go down by what was bought', async () => {
    await api.seed.catalog.products([
      {
        slug: 'pair-ring',
        variants: [
          { sku: 'pair-ring-9', onHandStock: 3 },
          { sku: 'pair-ring-11', onHandStock: 4 },
        ],
      },
    ]);
    const { session } = await checkedOut(api, {
      lines: [
        ['pair-ring', 'pair-ring-9', 1],
        ['pair-ring', 'pair-ring-11', 2],
        ['moon-ring', 'moon-ring-9', 3],
      ],
    });

    await deliver(api, api.payments.pay(session.id));

    expect(await stock(api, 'pair-ring')).toEqual({
      'pair-ring-9': { onHand: 2, reserved: 0 },
      'pair-ring-11': { onHand: 2, reserved: 0 },
    });
    expect(await stock(api, 'moon-ring')).toEqual({ 'moon-ring-9': { onHand: 0, reserved: 0 } });
  });
});

describe('the order confirmation email', () => {
  const api = useTestApi();

  beforeEach(async () => {
    await api.seed.catalog.products([
      {
        slug: 'moon-ring',
        name: { ja: '月のリング' },
        variants: [{ sku: 'moon-ring-9', label: { ja: '9号' }, priceYen: 9_000, onHandStock: 5 }],
      },
      {
        slug: 'star-necklace',
        name: { ja: '星のネックレス <Star> & Co' },
        variants: [{ sku: 'star-45', label: { ja: '45cm' }, priceYen: 4_000, onHandStock: 5 }],
      },
    ]);
  });

  test('the customer gets it once they have paid, with the order, the amounts, the address and the order page', async () => {
    const { order, token, session } = await checkedOut(api, {
      lines: [
        ['moon-ring', 'moon-ring-9', 2],
        ['star-necklace', 'star-45', 1],
      ],
    });
    expect(api.mailer.outbox).toEqual([]);

    await deliver(api, api.payments.pay(session.id));

    const email = api.mailer.outbox.find((sent) => sent.to === 'hanako@example.com');
    assert(email);
    expect(email.subject).toBe(`【Y&I Jewelry】ご注文ありがとうございます（ご注文番号 ${order}）`);
    // ¥18,000 and ¥4,000 make a subtotal of ¥22,000: shipping is free. Tax included: floor(22,000 × 10 / 110).
    for (const part of [
      '山田 花子 様',
      `ご注文番号：${order}`,
      '月のリング（9号）\n¥9,000 × 2 = ¥18,000',
      '星のネックレス <Star> & Co（45cm）\n¥4,000 × 1 = ¥4,000',
      '小計：¥22,000',
      '送料：¥0',
      '合計：¥22,000（うち消費税 ¥2,000）',
      '〒150-0001\n東京都渋谷区神宮前1-2-3 ジュエリービル 401\n山田 花子 様\n+819012345678',
      `https://shop.test/orders/${order}?token=${token}`,
    ]) {
      expect(email.text).toContain(part);
    }
    // The HTML part has it all too, the store's and the customer's texts escaped.
    expect(email.html).toContain('星のネックレス &lt;Star&gt; &amp; Co（45cm）');
    expect(email.html).toContain(`href="https://shop.test/orders/${order}?token=${token}"`);
    expect(email.html).toContain('合計');
    expect(email.html).toContain('¥22,000');
    expect(email.html).not.toContain('<Star>');
  });

  test('is in the locale the customer ordered in, with the products’ names in it', async () => {
    await api.seed.catalog.products([
      {
        slug: 'sun-ring',
        name: { ja: '太陽のリング', zh: '太阳戒指', en: 'Sun ring' },
        variants: [{ sku: 'sun-ring-9', label: { ja: '9号', zh: '9号', en: 'Size 9' }, priceYen: 9_000 }],
      },
    ]);
    const expected = {
      zh: {
        subject: (order: string) => `【Y&I Jewelry】感谢您的订购（订单号 ${order}）`,
        parts: (order: string, token: string) => [
          '山田 花子 您好：',
          `订单号：${order}`,
          '太阳戒指（9号）\n¥9,000 × 1 = ¥9,000',
          '小计：¥9,000',
          '运费：¥800',
          '合计：¥9,800（含消费税 ¥890）',
          `https://shop.test/zh/orders/${order}?token=${token}`,
        ],
      },
      en: {
        subject: (order: string) => `[Y&I Jewelry] Thank you for your order (Order ${order})`,
        parts: (order: string, token: string) => [
          'Dear 山田 花子,',
          `Order number: ${order}`,
          'Sun ring (Size 9)\n¥9,000 × 1 = ¥9,000',
          'Subtotal: ¥9,000',
          'Shipping: ¥800',
          'Total: ¥9,800 (including ¥890 consumption tax)',
          `https://shop.test/en/orders/${order}?token=${token}`,
        ],
      },
    };

    for (const [locale, { subject, parts }] of Object.entries(expected) as [
      'zh' | 'en',
      (typeof expected)['zh'],
    ][]) {
      const { order, token, session } = await checkedOut(api, { lines: [['sun-ring', 'sun-ring-9', 1]], locale });

      await deliver(api, api.payments.pay(session.id));

      const email = api.mailer.outbox.findLast((sent) => sent.to === 'hanako@example.com');
      assert(email);
      expect(email.subject).toBe(subject(order));
      for (const part of parts(order, token)) expect(email.text).toContain(part);
    }
  });

  test('the tax included is rounded down', async () => {
    const { session } = await checkedOut(api, { lines: [['moon-ring', 'moon-ring-9', 1]] });

    await deliver(api, api.payments.pay(session.id));

    // ¥9,000 and ¥800 shipping: floor(9,800 × 10 / 110) = floor(890.9…).
    expect(api.mailer.outbox.find((sent) => sent.to === 'hanako@example.com')?.text).toContain(
      '合計：¥9,800（うち消費税 ¥890）',
    );
  });
});

describe('the new order notice', () => {
  const api = useTestApi();

  beforeEach(async () => {
    await api.seed.catalog.products([
      {
        slug: 'moon-ring',
        name: { ja: '月のリング', en: 'Moon ring' },
        variants: [{ sku: 'moon-ring-9', label: { ja: '9号', en: 'Size 9' }, priceYen: 9_000, onHandStock: 5 }],
      },
    ]);
  });

  test('the owner gets it once the customer has paid, in Japanese whatever the customer’s locale', async () => {
    const { order, session } = await checkedOut(api, { lines: [['moon-ring', 'moon-ring-9', 1]], locale: 'en' });

    await deliver(api, api.payments.pay(session.id));

    const notice = api.mailer.outbox.find((sent) => sent.to === TEST_OWNER_NOTIFICATION_EMAIL);
    assert(notice);
    expect(notice.subject).toBe(`【新規注文】ご注文番号 ${order}（合計 ¥9,800）`);
    for (const part of [
      `ご注文番号：${order}`,
      // The Japanese names: the owner reads them in Japanese.
      '月のリング（9号）\n¥9,000 × 1 = ¥9,000',
      '合計：¥9,800（うち消費税 ¥890）',
      '〒150-0001\n東京都渋谷区神宮前1-2-3 ジュエリービル 401\n山田 花子 様\n+819012345678',
      'hanako@example.com',
      '英語',
    ]) {
      expect(notice.text).toContain(part);
    }
    expect(notice.html).toContain('月のリング（9号）');
  });
});

describe('the cart, once the order is paid', () => {
  const api = useTestApi();

  beforeEach(async () => {
    await api.seed.catalog.products([
      { slug: 'moon-ring', variants: [{ sku: 'moon-ring-9', onHandStock: 3 }] },
      { slug: 'star-necklace', variants: [{ sku: 'star-45', onHandStock: 3 }] },
    ]);
  });

  const cartLines = async (client: ReturnType<typeof api.client>) => {
    const res = await client.api.cart.$get({ query: { locale: 'ja' } });
    assert(res.status === 200);
    return (await res.json()).lines.map((line) => [line.sku, line.quantity]);
  };

  test('the thank-you page takes what was bought out of the cart, but not before the payment is confirmed', async () => {
    const { client, order, token, session } = await checkedOut(api);

    const pending = await orderLookup(client, order, token);

    expect(pending.headers.getSetCookie()).toEqual([]);
    expect(await cartLines(client)).toEqual([['moon-ring-9', 1]]);

    await deliver(api, api.payments.pay(session.id));
    const paid = await orderLookup(client, order, token);

    expect(await paid.json()).toMatchObject({ status: 'paid' });
    expect(await cartLines(client)).toEqual([]);
  });

  test('what the customer put in the cart since stays, also when they come back to the thank-you page later', async () => {
    const { client, order, token, session } = await checkedOut(api);
    await deliver(api, api.payments.pay(session.id));
    await orderLookup(client, order, token);
    await fill(client, ['star-necklace', 'star-45', 2]);

    await orderLookup(client, order, token);

    expect(await cartLines(client)).toEqual([['star-45', 2]]);
  });
});

describe('the payment service reports a payment page expired', () => {
  const api = useTestApi();

  beforeEach(async () => {
    await api.seed.catalog.products([{ slug: 'moon-ring', variants: [{ sku: 'moon-ring-9', onHandStock: 3 }] }]);
  });

  test('the order expires and its reserved stock is released', async () => {
    const { order, token, session } = await checkedOut(api, { lines: [['moon-ring', 'moon-ring-9', 2]] });

    const res = await deliver(api, api.payments.expire(session.id));

    expect(res.status).toBe(200);
    expect(await (await orderLookup(api.client(), order, token)).json()).toMatchObject({ status: 'expired' });
    expect(await stock(api, 'moon-ring')).toEqual({ 'moon-ring-9': { onHand: 3, reserved: 0 } });
    expect(api.mailer.outbox).toEqual([]);
  });

  test('for a checkout the customer cancelled (its order expired already), nothing changes', async () => {
    const { client, order, token, session } = await checkedOut(api);
    await client.api.checkout.orders[':orderId'].cancel.$post({ param: { orderId: order }, json: { token } });
    const other = await checkedOut(api);

    const res = await deliver(api, api.payments.expire(session.id));

    expect(res.status).toBe(200);
    // Only the other customer's checkout has the ring reserved: this one released it when cancelled.
    expect(await stock(api, 'moon-ring')).toEqual({ 'moon-ring-9': { onHand: 3, reserved: 1 } });
    expect(await (await orderLookup(api.client(), other.order, other.token)).json()).toMatchObject({
      status: 'pending_payment',
    });
  });
});

describe('an event that does not fit the order’s status', () => {
  const api = useTestApi();

  beforeEach(async () => {
    await api.seed.catalog.products([{ slug: 'moon-ring', variants: [{ sku: 'moon-ring-9', onHandStock: 3 }] }]);
  });

  test('is ignored: a paid order does not expire, and keeps its stock sold', async () => {
    const { order, token, session } = await checkedOut(api);
    await deliver(api, api.payments.pay(session.id));

    const res = await deliver(api, { type: 'checkout_expired', id: 'evt_late', orderId: order, sessionId: session.id });

    expect(res.status).toBe(200);
    expect(await (await orderLookup(api.client(), order, token)).json()).toMatchObject({ status: 'paid' });
    expect(await stock(api, 'moon-ring')).toEqual({ 'moon-ring-9': { onHand: 2, reserved: 0 } });
  });

  test('is ignored: an expired order is not paid, and sends no email', async () => {
    const { order, token, session } = await checkedOut(api);
    await deliver(api, api.payments.expire(session.id));

    const res = await deliver(api, api.payments.pay(session.id));

    expect(res.status).toBe(200);
    expect(await (await orderLookup(api.client(), order, token)).json()).toMatchObject({ status: 'expired' });
    expect(await stock(api, 'moon-ring')).toEqual({ 'moon-ring-9': { onHand: 3, reserved: 0 } });
    expect(api.mailer.outbox).toEqual([]);
  });

  test('for an order that does not exist, or another kind of event, is acknowledged and ignored', async () => {
    for (const event of [
      { type: 'checkout_expired', id: 'evt_x', orderId: '20260101000000-0000', sessionId: 'cs_x' },
      { type: 'other', id: 'evt_y' },
    ] as const) {
      expect((await deliver(api, event)).status).toBe(200);
    }
  });
});

describe('an event the payment service delivers more than once', () => {
  const api = useTestApi();

  beforeEach(async () => {
    await api.seed.catalog.products([{ slug: 'moon-ring', variants: [{ sku: 'moon-ring-9', onHandStock: 3 }] }]);
  });

  test('changes nothing more, and sends no email again', async () => {
    const { order, token, session } = await checkedOut(api);
    const event = api.payments.pay(session.id);
    await deliver(api, event);

    const again = await deliver(api, event);

    expect(again.status).toBe(200);
    expect(await (await orderLookup(api.client(), order, token)).json()).toMatchObject({ status: 'paid' });
    expect(await stock(api, 'moon-ring')).toEqual({ 'moon-ring-9': { onHand: 2, reserved: 0 } });
    expect(api.mailer.outbox.map((sent) => sent.to)).toEqual(['hanako@example.com', TEST_OWNER_NOTIFICATION_EMAIL]);
  });

  test('when an email cannot be sent, the payment stays recorded and the service is asked to deliver again; then each email goes once', async () => {
    const { order, token, session } = await checkedOut(api);
    const event = api.payments.pay(session.id);
    api.mailer.failNextSend({ to: TEST_OWNER_NOTIFICATION_EMAIL });

    const first = await deliver(api, event);

    expect(first.status).toBe(503);
    expect(await first.json()).toEqual({ error: 'try_again_later' });
    expect(await (await orderLookup(api.client(), order, token)).json()).toMatchObject({ status: 'paid' });
    expect(await stock(api, 'moon-ring')).toEqual({ 'moon-ring-9': { onHand: 2, reserved: 0 } });
    expect(api.mailer.outbox.map((sent) => sent.to)).toEqual(['hanako@example.com']);

    for (const delivery of [await deliver(api, event), await deliver(api, event)]) expect(delivery.status).toBe(200);

    expect(api.mailer.outbox.map((sent) => sent.to)).toEqual(['hanako@example.com', TEST_OWNER_NOTIFICATION_EMAIL]);
    expect(await stock(api, 'moon-ring')).toEqual({ 'moon-ring-9': { onHand: 2, reserved: 0 } });
  });
});

describe('the webhook', () => {
  const api = useTestApi();

  beforeEach(async () => {
    await api.seed.catalog.products([{ slug: 'moon-ring', variants: [{ sku: 'moon-ring-9', onHandStock: 3 }] }]);
  });

  test('refuses an event the payment service did not sign, or that was changed after it signed it', async () => {
    const { order, token, session } = await checkedOut(api);
    const event = api.payments.pay(session.id);
    const { body, headers } = api.payments.signed(event);
    const forged = [
      { body, headers: { 'content-type': 'application/json' } },
      { body, headers: { ...headers, 'stripe-signature': 'not-a-signature' } },
      { body: body.replace('hanako@example.com', 'someone@example.com'), headers },
    ];

    for (const request of forged) {
      const res = await api.request('/api/payment-events', { method: 'POST', ...request });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_signature' });
    }
    expect(await (await orderLookup(api.client(), order, token)).json()).toMatchObject({ status: 'pending_payment' });
    expect(await stock(api, 'moon-ring')).toEqual({ 'moon-ring-9': { onHand: 3, reserved: 1 } });
  });
});
