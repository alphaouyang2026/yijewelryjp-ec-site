import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Customer } from '../../src/ordering/domain/order';
import type { CheckoutSessionRequest, PaymentEvent, Payments } from '../../src/ordering/domain/payments';

/** Where the in-memory payment pages would be. */
export const PAYMENTS_ORIGIN = 'https://checkout.test';

/** A checkout session the API asked for: what it asked, and what became of the session. */
export type RecordedSession = {
  id: string;
  url: string;
  request: CheckoutSessionRequest;
  /** Open until the customer pays it (`complete`) or the API expires it. */
  status: 'open' | 'complete' | 'expired';
};

/**
 * What the in-memory payment service reports to the API's webhook: the
 * domain's payment events themselves, as JSON, signed with its webhook secret.
 */
export type PaymentServiceEvent = PaymentEvent;

/** The customer who pays, unless a test says otherwise: what they enter on the payment page. */
export const TEST_CUSTOMER: Customer = {
  email: 'hanako@example.com',
  phone: '+819012345678',
  shippingAddress: {
    name: '山田 花子',
    postalCode: '150-0001',
    prefecture: '東京都',
    city: '渋谷区',
    line1: '神宮前1-2-3',
    line2: 'ジュエリービル 401',
  },
};

const WEBHOOK_SECRET = 'test-webhook-secret';
const SIGNATURE_HEADER = 'stripe-signature';

export type InMemoryPayments = Payments & {
  /** Every session the API created, oldest first. */
  readonly sessions: RecordedSession[];
  /** The payment service fails the next request to create a session, as when Stripe is down. */
  failNextCreate(): void;
  /** The payment service fails the next request to expire a session. */
  failNextExpire(): void;
  /** The customer pays the session `id` on its payment page; the service does not report it (yet). */
  complete(id: string): void;
  /** The customer pays the session `id` on its payment page: what the service then reports. */
  pay(id: string, customer?: Customer): PaymentServiceEvent;
  /** The session `id` expires on the service, unpaid: what the service then reports. */
  expire(id: string): PaymentServiceEvent;
  /** The request body and headers delivering `event` to the webhook, signed as the service signs them. */
  signed(event: PaymentServiceEvent): { body: string; headers: Record<string, string> };
};

/** The Payments tests use: it records the sessions the API creates and never charges anyone. */
export function createInMemoryPayments(): InMemoryPayments {
  const sessions: RecordedSession[] = [];
  const failNext = { create: false, expire: false };
  let events = 0;
  const eventId = () => `evt_test_${(events += 1)}`;
  const session = (id: string) => {
    const found = sessions.find((candidate) => candidate.id === id);
    if (!found) throw new Error(`No checkout session ${id}`);
    return found;
  };

  return {
    sessions,
    async createCheckoutSession(request) {
      if (failNext.create) {
        failNext.create = false;
        throw new Error('The payment service is unavailable');
      }
      const id = `cs_test_${sessions.length + 1}`;
      const created: RecordedSession = { id, url: `${PAYMENTS_ORIGIN}/pay/${id}`, request, status: 'open' };
      sessions.push(created);
      return { id, url: created.url };
    },
    async expireCheckoutSession(id) {
      if (failNext.expire) {
        failNext.expire = false;
        throw new Error('The payment service is unavailable');
      }
      const expiring = session(id);
      if (expiring.status === 'complete') return 'completed';
      expiring.status = 'expired';
      return 'expired';
    },
    failNextCreate() {
      failNext.create = true;
    },
    failNextExpire() {
      failNext.expire = true;
    },
    complete(id) {
      session(id).status = 'complete';
    },
    pay(id, customer = TEST_CUSTOMER) {
      const paid = session(id);
      paid.status = 'complete';
      return { type: 'checkout_completed', id: eventId(), orderId: paid.request.orderId, sessionId: id, customer };
    },
    expire(id) {
      const expired = session(id);
      expired.status = 'expired';
      return { type: 'checkout_expired', id: eventId(), orderId: expired.request.orderId, sessionId: id };
    },
    signed(event) {
      const body = JSON.stringify(event);
      return { body, headers: { 'content-type': 'application/json', [SIGNATURE_HEADER]: signature(body) } };
    },
    async verifyEvent(payload, headers) {
      const sent = Buffer.from(headers.get(SIGNATURE_HEADER) ?? '');
      const expected = Buffer.from(signature(payload));
      if (sent.length !== expected.length || !timingSafeEqual(sent, expected)) return 'invalid';
      return JSON.parse(payload) as PaymentEvent;
    },
  };
}

function signature(payload: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
}
