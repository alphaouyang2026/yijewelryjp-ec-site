import type { ProductSort } from './api';
import { DEFAULT_PRODUCT_SORT } from './productSorts';

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
  product: (slug: string) => page(`/products/${slug}`),
  /** Every product, or one category's, in `sort` order; the default order (newest) leaves the URL plain. */
  productList: ({ category, sort }: { category?: string; sort: ProductSort }) => {
    const list = category === undefined ? '/products' : `/categories/${category}`;
    return page(sort === DEFAULT_PRODUCT_SORT ? list : `${list}?sort=${sort}`);
  },
  shippingReturns: page('/shipping-returns'),
  tokushoho: page('/tokushoho'),
  privacy: page('/privacy'),
  terms: page('/terms'),
  admin: page('/admin'),
  adminSection: (section: AdminSection) => page(`/admin/${section}`),
};

/** The admin's sections, in its navigation's order. */
export const ADMIN_SECTIONS = ['products', 'categories', 'orders', 'settings'] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];
