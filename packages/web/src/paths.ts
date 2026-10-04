/** The site's page paths, built only here. Route definitions and links both use them. */
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
