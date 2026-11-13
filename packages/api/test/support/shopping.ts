import { assert, expect } from 'vitest';
import type { PaymentServiceEvent } from './in-memory-payments';
import type { useTestApi } from './test-api';

// What customers (and the owner) do on the way to an order, as the API's
// tests of checkout and of payment events share them.

export type Locale = 'ja' | 'zh' | 'en';
export type Api = ReturnType<typeof useTestApi>;
export type Client = ReturnType<Api['client']>;

/** Adds each [slug, SKU, quantity] to the client's cart. */
export async function fill(client: Client, ...lines: [string, string, number][]) {
  for (const [productSlug, sku, quantity] of lines) {
    const res = await client.api.cart.lines.$post({ query: { locale: 'ja' }, json: { productSlug, sku, quantity } });
    expect(res.status).toBe(200);
  }
}

export function checkout(client: Client, locale: Locale = 'ja') {
  return client.api.checkout.$post({ query: { locale } });
}

/**
 * A customer checks out `lines` (by default one ring): their client, and the
 * order number and checkout token the payment page's return URLs carry.
 */
export async function checkedOut(
  api: Api,
  { lines = [['moon-ring', 'moon-ring-9', 1]], locale = 'ja' }: { lines?: [string, string, number][]; locale?: Locale } = {},
) {
  const client = api.client();
  await fill(client, ...lines);
  expect((await checkout(client, locale)).status).toBe(200);
  const session = api.payments.sessions.at(-1);
  assert(session);
  const returnUrl = new URL(session.request.successUrl);
  return {
    client,
    order: returnUrl.searchParams.get('order') ?? '',
    token: returnUrl.searchParams.get('token') ?? '',
    session,
  };
}

/** The payment service delivers `event` to the API's webhook, signed as it signs them. */
export function deliver(api: Api, event: PaymentServiceEvent) {
  return api.request('/api/payment-events', { method: 'POST', ...api.payments.signed(event) });
}

/** The thank-you page's lookup of the order. */
export function orderLookup(client: Client, order: string, token: string) {
  return client.api.checkout.orders[':orderId'].$get({ param: { orderId: order }, query: { token } });
}

/** Each variant's reserved stock, as the admin shows it. */
export async function reservedStock(api: Api, slug: string): Promise<Record<string, number>> {
  return Object.fromEntries((await variants(api, slug)).map((variant) => [variant.sku, variant.reservedStock]));
}

/** Each variant's on-hand and reserved stock, as the admin shows them. */
export async function stock(api: Api, slug: string): Promise<Record<string, { onHand: number; reserved: number }>> {
  return Object.fromEntries(
    (await variants(api, slug)).map((variant) => [
      variant.sku,
      { onHand: variant.onHandStock, reserved: variant.reservedStock },
    ]),
  );
}

async function variants(api: Api, slug: string) {
  const { client } = await api.owner();
  const res = await client.api.admin.products[':slug'].$get({ param: { slug } });
  assert(res.status === 200);
  return (await res.json()).variants;
}
