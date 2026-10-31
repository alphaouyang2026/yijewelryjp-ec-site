import type { Locale } from '../../shared-kernel/locale';
import type { Money } from '../../shared-kernel/money';
import type { Customer } from './order';

/** What the payment page charges for one order line, with its texts in the order's locale. */
export type CheckoutSessionLine = {
  name: string;
  variantLabel: string;
  /** Tax-inclusive. */
  unitPrice: Money;
  quantity: number;
};

/** A checkout session to create: the payment page for one order. */
export type CheckoutSessionRequest = {
  /** The order's number, which the payment service reports back with the session's events. */
  orderId: string;
  /** The payment page's locale: the order's. */
  locale: Locale;
  lines: CheckoutSessionLine[];
  /** One fixed shipping charge for the order; zero when shipping is free. */
  shippingFee: Money;
  /** Where the customer goes once they have paid. */
  successUrl: string;
  /** Where the customer goes when they leave the payment page without paying. */
  cancelUrl: string;
  /** When the session expires if not paid by then; the payment service then reports it expired. */
  expiresAt: Date;
};

/** A checkout session the payment service created: its id, and the URL of its payment page. */
export type CheckoutSession = { id: string; url: string };

/**
 * What the payment service reports about a checkout session (a payment
 * event), once it is verified to come from the service. Each has the
 * service's own id; the service may deliver one more than once.
 */
export type PaymentEvent =
  /** The customer paid the session's payment page, where they gave their contact details and address. */
  | { type: 'checkout_completed'; id: string; orderId: string; sessionId: string; customer: Customer }
  /** The session's payment page expired unpaid. */
  | { type: 'checkout_expired'; id: string; orderId: string; sessionId: string }
  /** Anything else the service reports: the store has nothing to do with it. */
  | { type: 'other'; id: string };

/**
 * The payment service (Stripe), which the store cannot control: production
 * uses the Stripe adapter, tests an in-memory one. Card details never reach
 * the store: customers enter them on the service's own pages.
 */
export interface Payments {
  /** Creates the payment page for an order. Rejects if the service fails or refuses. */
  createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSession>;
  /**
   * Ends the session `id` so it can no longer be paid: 'expired' once it can
   * never be paid (also when it had already expired), 'completed' if the
   * customer already paid it. Rejects if the service fails.
   */
  expireCheckoutSession(id: string): Promise<'expired' | 'completed'>;
  /**
   * The event a request to the webhook delivers, with its body `payload` and
   * `headers`; 'invalid' unless the service signed it, as no one else can.
   */
  verifyEvent(payload: string, headers: Headers): Promise<PaymentEvent | 'invalid'>;
}
