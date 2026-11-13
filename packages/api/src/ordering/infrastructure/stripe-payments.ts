import Stripe from 'stripe';
import type { Locale } from '../../shared-kernel/locale';
import type { Customer } from '../domain/order';
import type { CheckoutSessionRequest, PaymentEvent, Payments } from '../domain/payments';

/** The shipping charge's name on the payment page, in its locale. */
const SHIPPING_NAMES: Record<Locale, { fee: string; free: string }> = {
  ja: { fee: '送料', free: '送料無料' },
  zh: { fee: '运费', free: '免运费' },
  en: { fee: 'Shipping', free: 'Free shipping' },
};

/**
 * Payments on Stripe Checkout, with the account's secret key: test mode on
 * staging, live on production. Each payment page is a hosted Checkout
 * Session in yen, its lines given as inline price data (the catalog lives
 * only in the store's table, not in Stripe Products), with one fixed shipping
 * option, shipping to Japan only, and the customer's phone number. The
 * session's metadata and client reference carry the order number, which the
 * session's events report back. Events come to the webhook signed with the
 * webhook endpoint's signing secret, `webhookSecret`.
 */
export function stripePayments(secretKey: string, webhookSecret: string): Payments {
  const stripe = new Stripe(secretKey);

  return {
    async createCheckoutSession(request) {
      const session = await stripe.checkout.sessions.create(sessionParams(request), {
        // Retrying the same order's request never creates a second page.
        idempotencyKey: `checkout-${request.orderId}`,
      });
      if (!session.url) throw new Error(`Stripe created checkout session ${session.id} without a URL`);
      return { id: session.id, url: session.url };
    },

    async expireCheckoutSession(id) {
      try {
        await stripe.checkout.sessions.expire(id);
        return 'expired';
      } catch (error) {
        // Only an open session can be expired: one that is no longer open was paid, or has expired.
        const { status } = await stripe.checkout.sessions.retrieve(id);
        if (status === 'complete') return 'completed';
        if (status === 'expired') return 'expired';
        throw error;
      }
    },

    async verifyEvent(payload, headers) {
      const signature = headers.get('stripe-signature');
      if (!signature || !webhookSecret) return 'invalid';
      let event: Stripe.Event;
      try {
        event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
      } catch {
        return 'invalid';
      }
      return paymentEventOf(event);
    },
  };
}

/** What a Stripe event reports, as a payment event: the checkout sessions' completions and expiries. */
function paymentEventOf(event: Stripe.Event): PaymentEvent {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      // Cards (and the wallets, Apple Pay and Google Pay) are paid when the session completes.
      if (!orderId || session.payment_status !== 'paid') {
        console.warn('A completed checkout session is not a paid order', { eventId: event.id, sessionId: session.id });
        return { type: 'other', id: event.id };
      }
      return {
        type: 'checkout_completed',
        id: event.id,
        orderId,
        sessionId: session.id,
        customer: customerOf(session),
      };
    }
    case 'checkout.session.expired': {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (!orderId) return { type: 'other', id: event.id };
      return { type: 'checkout_expired', id: event.id, orderId, sessionId: session.id };
    }
    default:
      return { type: 'other', id: event.id };
  }
}

/**
 * The customer's details as they gave them on the payment page, which
 * requires the email address, the phone number and a shipping address in Japan.
 */
function customerOf(session: Stripe.Checkout.Session): Customer {
  const email = session.customer_details?.email;
  const shipping = session.collected_information?.shipping_details;
  if (!email || !shipping) throw new Error(`Checkout session ${session.id} has no email address or shipping address`);
  const { address } = shipping;
  return {
    email,
    phone: session.customer_details?.phone ?? undefined,
    shippingAddress: {
      name: shipping.name,
      postalCode: address.postal_code ?? '',
      prefecture: address.state ?? '',
      city: address.city ?? '',
      line1: address.line1 ?? '',
      line2: address.line2 || undefined,
    },
  };
}

function sessionParams(request: CheckoutSessionRequest): Stripe.Checkout.SessionCreateParams {
  const shippingName = SHIPPING_NAMES[request.locale];
  return {
    mode: 'payment',
    // Cards, with Apple Pay and Google Pay (card wallets): paid at once. Not
    // methods paid later (konbini, bank transfer), which a 31-minute page cannot wait for.
    allowed_payment_method_types: ['card'],
    currency: 'jpy',
    locale: request.locale,
    line_items: request.lines.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency: 'jpy',
        // Yen has no minor unit: the amount is in yen.
        unit_amount: line.unitPrice.yen,
        // Prices are tax-inclusive (総額表示).
        tax_behavior: 'inclusive',
        product_data: { name: line.name, description: line.variantLabel },
      },
    })),
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: request.shippingFee.yen === 0 ? shippingName.free : shippingName.fee,
          fixed_amount: { amount: request.shippingFee.yen, currency: 'jpy' },
          tax_behavior: 'inclusive',
        },
      },
    ],
    shipping_address_collection: { allowed_countries: ['JP'] },
    phone_number_collection: { enabled: true },
    expires_at: Math.floor(request.expiresAt.getTime() / 1000),
    success_url: request.successUrl,
    cancel_url: request.cancelUrl,
    client_reference_id: request.orderId,
    metadata: { orderId: request.orderId },
    payment_intent_data: { metadata: { orderId: request.orderId } },
  };
}
