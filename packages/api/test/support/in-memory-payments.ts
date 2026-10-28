import type { CheckoutSessionRequest, Payments } from '../../src/ordering/domain/payments';

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

export type InMemoryPayments = Payments & {
  /** Every session the API created, oldest first. */
  readonly sessions: RecordedSession[];
  /** The payment service fails the next request to create a session, as when Stripe is down. */
  failNextCreate(): void;
  /** The payment service fails the next request to expire a session. */
  failNextExpire(): void;
  /** The customer pays the session `id` on its payment page. */
  complete(id: string): void;
};

/** The Payments tests use: it records the sessions the API creates and never charges anyone. */
export function createInMemoryPayments(): InMemoryPayments {
  const sessions: RecordedSession[] = [];
  const failNext = { create: false, expire: false };
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
  };
}
