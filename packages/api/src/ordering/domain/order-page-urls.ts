import type { Locale } from '../../shared-kernel/locale';

/**
 * The storefront's pages about one order, in a locale: those the payment page
 * sends the customer back to, and the order page the emails link to. Each
 * carries the order's checkout token, so only the customer who started the
 * checkout can see the order or cancel its checkout.
 */
export type OrderPageUrls = {
  /** The thank-you page, once the customer has paid. */
  completed(locale: Locale, order: { id: string; checkoutToken: string }): string;
  /** Where the customer lands when they leave the payment page without paying: their checkout is cancelled. */
  cancelled(locale: Locale, order: { id: string; checkoutToken: string }): string;
  /** The order page: the order and its status, for as long as the customer keeps the link. */
  status(locale: Locale, order: { id: string; checkoutToken: string }): string;
};
