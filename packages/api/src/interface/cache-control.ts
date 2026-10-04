import type { MiddlewareHandler } from 'hono';

// CloudFront caches /api/* responses only as their Cache-Control header allows
// (see the infrastructure in packages/infra), so these values are the API's
// caching rules.

/**
 * Public catalog data (home, products, categories, policy pages): CloudFront
 * and browsers may keep it for about a minute, then serve it stale for a
 * little longer while it refreshes. Stock shown from it may lag by that much;
 * checkout re-checks stock against the table.
 */
export const PUBLIC_CATALOG_CACHE = 'public, max-age=60, stale-while-revalidate=30';

/**
 * Makes every API response uncacheable unless its route set a Cache-Control
 * header, so the cart, checkout, order, admin and webhook routes, and every
 * error, are never cached without anyone having to remember it.
 */
export const noStoreUnlessAllowed: MiddlewareHandler = async (c, next) => {
  await next();
  if (!c.res.headers.has('Cache-Control')) c.res.headers.set('Cache-Control', 'no-store');
};
