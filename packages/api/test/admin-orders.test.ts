import { assert, beforeEach, describe, expect, test } from 'vitest';
import { checkedOut, deliver, type Api, type Locale } from './support/shopping';
import { TEST_CUSTOMER } from './support/in-memory-payments';
import { useTestApi } from './support/test-api';

/**
 * A customer checks out one ring at `at` (Japan time); then the payment
 * service reports the checkout paid or expired, unless it stays pending
 * payment. Its order number.
 */
async function orderAt(api: Api, at: string, becomes: 'pending_payment' | 'paid' | 'expired') {
  api.clock.set(new Date(`${at}+09:00`));
  const { order, session } = await checkedOut(api);
  if (becomes === 'paid') await deliver(api, api.payments.pay(session.id));
  if (becomes === 'expired') await deliver(api, api.payments.expire(session.id));
  return order;
}

describe('the admin’s order list', () => {
  const api = useTestApi();

  beforeEach(async () => {
    await api.seed.catalog.products([{ slug: 'moon-ring', variants: [{ sku: 'moon-ring-9', onHandStock: 10 }] }]);
  });

  test('lists the orders the owner has to see to, the most recent first: none pending payment or expired', async () => {
    const earlier = await orderAt(api, '2026-11-01T10:00:00', 'paid');
    await orderAt(api, '2026-11-01T11:00:00', 'pending_payment');
    await orderAt(api, '2026-11-01T12:00:00', 'expired');
    const later = await orderAt(api, '2026-11-01T13:00:00', 'paid');
    const owner = await api.owner();

    const res = await owner.client.api.admin.orders.$get({ query: {} });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      orders: [
        {
          orderNumber: later,
          status: 'paid',
          placedAt: '2026-11-01T04:00:00.000Z',
          recipient: '山田 花子',
          quantity: 1,
          totalYen: 10_800,
        },
        {
          orderNumber: earlier,
          status: 'paid',
          placedAt: '2026-11-01T01:00:00.000Z',
          recipient: '山田 花子',
          quantity: 1,
          totalYen: 10_800,
        },
      ],
    });
  });
});

describe('the admin’s order list, by status', () => {
  const api = useTestApi();

  beforeEach(async () => {
    await api.seed.catalog.products([{ slug: 'moon-ring', variants: [{ sku: 'moon-ring-9', onHandStock: 10 }] }]);
  });

  test('with a status, lists only the orders in it, also those the list leaves out by default', async () => {
    await orderAt(api, '2026-11-01T10:00:00', 'paid');
    const pending = await orderAt(api, '2026-11-01T11:00:00', 'pending_payment');
    const expired = await orderAt(api, '2026-11-01T12:00:00', 'expired');
    const owner = await api.owner();

    const orderNumbers = async (status: 'pending_payment' | 'expired') => {
      const res = await owner.client.api.admin.orders.$get({ query: { status } });
      assert(res.status === 200);
      return (await res.json()).orders.map((order) => [order.orderNumber, order.status, order.recipient]);
    };

    expect(await orderNumbers('pending_payment')).toEqual([[pending, 'pending_payment', null]]);
    expect(await orderNumbers('expired')).toEqual([[expired, 'expired', null]]);
  });
});

describe('an order in the admin', () => {
  const api = useTestApi();

  beforeEach(async () => {
    await api.seed.catalog.products([
      {
        slug: 'moon-ring',
        name: { ja: '月のリング', zh: '月亮戒指' },
        variants: [{ sku: 'moon-ring-9', label: { ja: '9号' }, priceYen: 9_000, onHandStock: 5 }],
      },
    ]);
  });

  test('shows the order as the customer paid it, in the owner’s locale: lines, amounts, address, email and phone', async () => {
    api.clock.set(new Date('2026-11-01T10:00:00+09:00'));
    const { order, session } = await checkedOut(api, { lines: [['moon-ring', 'moon-ring-9', 2]] });
    await deliver(api, api.payments.pay(session.id));
    const owner = await api.owner();

    const res = await owner.client.api.admin.orders[':orderNumber'].$get({
      param: { orderNumber: order },
      query: { locale: 'zh' },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      orderNumber: order,
      status: 'paid',
      placedAt: '2026-11-01T01:00:00.000Z',
      orderedIn: 'ja',
      lines: [{ name: '月亮戒指', variantLabel: '9号', unitPriceYen: 9_000, quantity: 2, lineAmountYen: 18_000 }],
      subtotalYen: 18_000,
      shippingYen: 800,
      totalYen: 18_800,
      taxIncludedYen: 1_709,
      shippingAddress: TEST_CUSTOMER.shippingAddress,
      email: 'hanako@example.com',
      phone: '+819012345678',
      shipment: null,
      shippingNoticeSent: false,
      version: expect.any(Number),
    });
  });

  test('before the payment, the order has no address or contact details yet', async () => {
    const { order } = await checkedOut(api);
    const owner = await api.owner();

    const res = await owner.client.api.admin.orders[':orderNumber'].$get({
      param: { orderNumber: order },
      query: { locale: 'ja' },
    });

    expect(await res.json()).toMatchObject({ status: 'pending_payment', shippingAddress: null, email: null, phone: null });
  });

  test('no order has the number: 404', async () => {
    const owner = await api.owner();

    const res = await owner.client.api.admin.orders[':orderNumber'].$get({
      param: { orderNumber: '20261101100000-ZZZZ' },
      query: { locale: 'ja' },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});

describe('marking an order shipped', () => {
  const api = useTestApi();

  beforeEach(async () => {
    await api.seed.catalog.products([{ slug: 'moon-ring', variants: [{ sku: 'moon-ring-9', onHandStock: 10 }] }]);
  });

  type Owner = Awaited<ReturnType<Api['owner']>>;

  /** A customer checks out a ring and pays: its order number. */
  async function paidOrder() {
    const { order, session } = await checkedOut(api);
    await deliver(api, api.payments.pay(session.id));
    return order;
  }

  async function adminOrder(owner: Owner, orderNumber: string) {
    const res = await owner.client.api.admin.orders[':orderNumber'].$get({
      param: { orderNumber },
      query: { locale: 'ja' },
    });
    assert(res.status === 200);
    return res.json();
  }

  function ship(
    owner: Owner,
    orderNumber: string,
    shipment: { version: number; carrier: string; carrierName?: string; trackingNumber: string },
  ) {
    return owner.client.api.admin.orders[':orderNumber'].shipment.$post(
      { param: { orderNumber }, json: shipment as never },
      { headers: owner.headers },
    );
  }

  test('a paid order ships with its carrier and tracking number: the admin shows it shipped', async () => {
    api.clock.set(new Date('2026-11-03T15:00:00+09:00'));
    const order = await paidOrder();
    const owner = await api.owner();
    const { version } = await adminOrder(owner, order);

    const res = await ship(owner, order, { version, carrier: 'yamato', trackingNumber: ' 1234-5678-9012 ' });

    expect(res.status).toBe(200);
    const shipped = {
      status: 'shipped',
      shipment: { carrier: 'yamato', carrierName: null, trackingNumber: '1234-5678-9012', shippedAt: '2026-11-03T06:00:00.000Z' },
    };
    expect(await res.json()).toMatchObject(shipped);
    expect(await adminOrder(owner, order)).toMatchObject(shipped);
  });

  test('with another carrier, its name goes with the shipment', async () => {
    const order = await paidOrder();
    const owner = await api.owner();
    const { version } = await adminOrder(owner, order);

    const res = await ship(owner, order, { version, carrier: 'other', carrierName: '西濃運輸', trackingNumber: 'A-1' });

    expect(await res.json()).toMatchObject({ shipment: { carrier: 'other', carrierName: '西濃運輸', trackingNumber: 'A-1' } });
  });

  test('a paid order is the only one that can ship: any other is refused as it is', async () => {
    const owner = await api.owner();
    const pending = (await checkedOut(api)).order;
    const expiredCheckout = await checkedOut(api);
    await deliver(api, api.payments.expire(expiredCheckout.session.id));
    const shipped = await paidOrder();
    await ship(owner, shipped, { version: (await adminOrder(owner, shipped)).version, carrier: 'sagawa', trackingNumber: '1' });

    for (const order of [pending, expiredCheckout.order, shipped]) {
      const before = await adminOrder(owner, order);

      const res = await ship(owner, order, { version: before.version, carrier: 'japan_post', trackingNumber: '2' });

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'invalid_status_transition' });
      expect(await adminOrder(owner, order)).toEqual(before);
    }
  });

  test('an order changed since the owner opened it is not shipped: 409 stale_version', async () => {
    const order = await paidOrder();
    const owner = await api.owner();
    const { version } = await adminOrder(owner, order);

    const res = await ship(owner, order, { version: version - 1, carrier: 'yamato', trackingNumber: '1' });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'stale_version' });
    expect(await adminOrder(owner, order)).toMatchObject({ status: 'paid', shipment: null });
  });

  test('a shipment without its tracking number, or another carrier without its name, says which field is wrong', async () => {
    const order = await paidOrder();
    const owner = await api.owner();
    const { version } = await adminOrder(owner, order);

    const blank = await ship(owner, order, { version, carrier: 'yamato', trackingNumber: '  ' });
    const unnamed = await ship(owner, order, { version, carrier: 'other', trackingNumber: '1' });
    const unknown = await ship(owner, order, { version, carrier: 'dhl', trackingNumber: 'x'.repeat(41) });

    expect(blank.status).toBe(400);
    expect(await blank.json()).toEqual({ error: 'invalid_input', fields: [{ path: 'trackingNumber', code: 'required' }] });
    expect(await unnamed.json()).toEqual({ error: 'invalid_input', fields: [{ path: 'carrierName', code: 'required' }] });
    expect(await unknown.json()).toEqual({
      error: 'invalid_input',
      fields: [
        { path: 'carrier', code: 'invalid' },
        { path: 'trackingNumber', code: 'too_long' },
      ],
    });
    expect(await adminOrder(owner, order)).toMatchObject({ status: 'paid', shipment: null });
  });

  test('no order has the number: 404', async () => {
    const owner = await api.owner();

    const res = await ship(owner, '20261101100000-ZZZZ', { version: 1, carrier: 'yamato', trackingNumber: '1' });

    expect(res.status).toBe(404);
  });
});

describe('the shipping notice', () => {
  const api = useTestApi();

  beforeEach(async () => {
    await api.seed.catalog.products([
      {
        slug: 'moon-ring',
        name: { ja: '月のリング', zh: '月亮戒指', en: 'Moon Ring' },
        variants: [{ sku: 'moon-ring-9', label: { ja: '9号' }, onHandStock: 10 }],
      },
    ]);
  });

  type Owner = Awaited<ReturnType<Api['owner']>>;

  /**
   * A customer checks out a ring in `locale` and pays; the owner ships it by
   * Yamato as 1234-5678-9012, the mail service failing the notice if asked.
   * The emails shipping it sent.
   */
  async function shipped(owner: Owner, { locale = 'ja', failNotice = false }: { locale?: Locale; failNotice?: boolean } = {}) {
    const { order, token, session } = await checkedOut(api, { locale });
    await deliver(api, api.payments.pay(session.id));
    const opened = await owner.client.api.admin.orders[':orderNumber'].$get({
      param: { orderNumber: order },
      query: { locale: 'ja' },
    });
    assert(opened.status === 200);
    const sentBefore = api.mailer.outbox.length;
    if (failNotice) api.mailer.failNextSend({ to: 'hanako@example.com' });
    const res = await owner.client.api.admin.orders[':orderNumber'].shipment.$post(
      {
        param: { orderNumber: order },
        json: { version: (await opened.json()).version, carrier: 'yamato', trackingNumber: '1234-5678-9012' },
      },
      { headers: owner.headers },
    );
    return { order, token, res, emails: api.mailer.outbox.slice(sentBefore) };
  }

  test.each([
    {
      locale: 'ja' as const,
      subject: (order: string) => `【Y&I Jewelry】ご注文の商品を発送しました（ご注文番号 ${order}）`,
      parts: ['山田 花子 様', 'ヤマト運輸', '伝票番号：1234-5678-9012', '月のリング（9号）', '東京都渋谷区神宮前1-2-3'],
      path: '/orders/',
    },
    {
      locale: 'zh' as const,
      subject: (order: string) => `【Y&I Jewelry】您的订单已发货（订单号 ${order}）`,
      parts: ['山田 花子 您好：', '大和运输', '运单号：1234-5678-9012', '月亮戒指（9号）'],
      path: '/zh/orders/',
    },
    {
      locale: 'en' as const,
      subject: (order: string) => `[Y&I Jewelry] Your order has shipped (order ${order})`,
      parts: ['Dear 山田 花子,', 'Yamato Transport', 'Tracking number: 1234-5678-9012', 'Moon Ring (9号)'],
      path: '/en/orders/',
    },
  ])('shipping emails the customer, in the locale they ordered in ($locale): the carrier, the tracking number, the order and its page', async (expected) => {
    const owner = await api.owner();

    const { order, token, res, emails } = await shipped(owner, { locale: expected.locale });

    expect(await res.json()).toMatchObject({ status: 'shipped', shippingNoticeSent: true });
    expect(emails.map((email) => [email.to, email.subject])).toEqual([['hanako@example.com', expected.subject(order)]]);
    for (const part of [...expected.parts, `https://shop.test${expected.path}${order}?token=${token}`]) {
      expect(emails[0]?.text).toContain(part);
    }
    expect(emails[0]?.html).toContain('1234-5678-9012');
  });

  test('a notice the mail service cannot send leaves the order shipped, and the admin says it is still to send', async () => {
    const owner = await api.owner();

    const { order, res, emails } = await shipped(owner, { failNotice: true });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'shipped', shippingNoticeSent: false });
    expect(emails).toEqual([]);
    const opened = await owner.client.api.admin.orders[':orderNumber'].$get({
      param: { orderNumber: order },
      query: { locale: 'ja' },
    });
    expect(await opened.json()).toMatchObject({ status: 'shipped', shippingNoticeSent: false });
  });

  test('the owner sends a notice that could not be sent again, once', async () => {
    const owner = await api.owner();
    const { order } = await shipped(owner, { failNotice: true });
    const sentBefore = api.mailer.outbox.length;
    const resend = () =>
      owner.client.api.admin.orders[':orderNumber']['shipping-notice'].$post(
        { param: { orderNumber: order } },
        { headers: owner.headers },
      );

    const first = await resend();
    const second = await resend();

    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ shippingNoticeSent: true });
    expect(await second.json()).toMatchObject({ shippingNoticeSent: true });
    expect(api.mailer.outbox.slice(sentBefore).map((email) => email.to)).toEqual(['hanako@example.com']);
  });

  test('an order not shipped has no notice to send: 409', async () => {
    const owner = await api.owner();
    const { order, session } = await checkedOut(api);
    await deliver(api, api.payments.pay(session.id));

    const res = await owner.client.api.admin.orders[':orderNumber']['shipping-notice'].$post(
      { param: { orderNumber: order } },
      { headers: owner.headers },
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'invalid_status_transition' });
  });
});
