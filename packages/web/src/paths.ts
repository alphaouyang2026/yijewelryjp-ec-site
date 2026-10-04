/**
 * The site's page paths, built only here, without a locale prefix. Route
 * definitions and links both use them; the route table and LocalizedLink add
 * each locale's prefix (i18n/locales.ts).
 */
export const paths = {
  home: '/',
  cart: '/cart',
  products: '/products',
  category: (slug: string) => `/categories/${slug}`,
  shippingReturns: '/shipping-returns',
  tokushoho: '/tokushoho',
  privacy: '/privacy',
  terms: '/terms',
};
