declare const pagePathBrand: unique symbol;

/**
 * A page's path without a locale prefix, maybe with a query and hash: '/cart',
 * '/?utm_source=line'. Only `paths` below and `pathWithoutLocale`
 * (i18n/locales.ts) make one, so a path that already has a locale prefix, or
 * any other string, cannot be passed where a page path is expected.
 */
export type PagePath = string & { readonly [pagePathBrand]: true };

const page = (path: string) => path as PagePath;

/**
 * The site's page paths, built only here, without a locale prefix. Route
 * definitions and links both use them; the route table and LocalizedLink add
 * each locale's prefix (i18n/locales.ts).
 */
export const paths = {
  home: page('/'),
  cart: page('/cart'),
  products: page('/products'),
  category: (slug: string) => page(`/categories/${slug}`),
  shippingReturns: page('/shipping-returns'),
  tokushoho: page('/tokushoho'),
  privacy: page('/privacy'),
  terms: page('/terms'),
};
