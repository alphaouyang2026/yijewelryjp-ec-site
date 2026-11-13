import type { Locale } from '../../shared-kernel/locale';
import type { OrderPageUrls } from '../domain/order-page-urls';

/**
 * The storefront's order pages on the site at `siteUrl` (packages/web's
 * paths.ts has the same paths): under each locale's prefix (ADR 0004). The
 * checkout pages take the order's number and checkout token in the query;
 * the order page has the number in its path.
 */
export function orderPageUrls(siteUrl: string): OrderPageUrls {
  const prefix = (locale: Locale) => `${siteUrl}${locale === 'ja' ? '' : `/${locale}`}`;
  const checkoutPage = (path: string) => (locale: Locale, order: { id: string; checkoutToken: string }) => {
    const query = new URLSearchParams({ order: order.id, token: order.checkoutToken });
    return `${prefix(locale)}${path}?${query}`;
  };
  return {
    completed: checkoutPage('/checkout/complete'),
    cancelled: checkoutPage('/checkout/cancelled'),
    status: (locale, order) =>
      `${prefix(locale)}/orders/${encodeURIComponent(order.id)}?${new URLSearchParams({ token: order.checkoutToken })}`,
  };
}
