import type { Locale } from '../../shared-kernel/locale';
import type { CheckoutReturnUrls } from '../domain/checkout-urls';

/**
 * The storefront's checkout pages on the site at `siteUrl` (packages/web's
 * paths.ts has the same paths): under each locale's prefix (ADR 0004), with
 * the order's number and checkout token in the query.
 */
export function checkoutReturnUrls(siteUrl: string): CheckoutReturnUrls {
  const page = (path: string) => (locale: Locale, order: { id: string; checkoutToken: string }) => {
    const query = new URLSearchParams({ order: order.id, token: order.checkoutToken });
    return `${siteUrl}${locale === 'ja' ? '' : `/${locale}`}${path}?${query}`;
  };
  return { completed: page('/checkout/complete'), cancelled: page('/checkout/cancelled') };
}
