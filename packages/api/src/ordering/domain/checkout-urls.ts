import type { Locale } from '../../shared-kernel/locale';

/**
 * The storefront's pages the payment page sends the customer back to, in the
 * order's locale. Each carries the order's number and checkout token, so only
 * that customer's browser can look the order up or cancel its checkout.
 */
export type CheckoutReturnUrls = {
  /** The thank-you page, once the customer has paid. */
  completed(locale: Locale, order: { id: string; checkoutToken: string }): string;
  /** Where the customer lands when they leave the payment page without paying: their checkout is cancelled. */
  cancelled(locale: Locale, order: { id: string; checkoutToken: string }): string;
};
