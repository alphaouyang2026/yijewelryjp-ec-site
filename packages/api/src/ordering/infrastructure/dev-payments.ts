// For local development only (src/local.ts), when no Stripe test key is set:
// production code never imports this module (ESLint checks).
import type { Payments } from '../domain/payments';

/**
 * Payments without a payment service: the "payment page" is the thank-you
 * page itself, as if the customer had paid at once. No payment is ever
 * reported, so the order stays pending payment, and its stock reserved; and
 * nothing is charged. With STRIPE_SECRET_KEY set to a test key, local
 * development uses Stripe's test mode instead.
 */
export function devPayments(): Payments {
  let sessions = 0;
  return {
    async createCheckoutSession(request) {
      sessions += 1;
      return { id: `cs_dev_${sessions}`, url: request.successUrl };
    },
    async expireCheckoutSession() {
      return 'expired';
    },
  };
}
