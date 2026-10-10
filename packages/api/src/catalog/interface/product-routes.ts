import { Hono } from 'hono';
import * as z from 'zod';
import { PUBLIC_CATALOG_CACHE } from '../../interface/cache-control';
import { localeQuery, localeQueryWith } from '../../interface/locale-query';
import type { GetProduct } from '../application/get-product';
import { PRODUCT_SORTS, type ListProducts } from '../application/list-products';

const productListQuery = localeQueryWith({
  sort: z.enum(PRODUCT_SORTS).default('newest'),
  category: z.string().min(1).optional(),
});

/** The product list (all, or one category's) and each listed product's page. */
export function productRoutes(listProducts: ListProducts, getProduct: GetProduct) {
  return new Hono()
    .get('/', productListQuery, async (c) => {
      const { locale, sort, category } = c.req.valid('query');
      const list = await listProducts({ locale, sort, categorySlug: category });
      if (!list) return c.json({ error: 'not_found' }, 404);
      c.header('Cache-Control', PUBLIC_CATALOG_CACHE);
      return c.json(list, 200);
    })
    .get('/:slug', localeQuery, async (c) => {
      const page = await getProduct({ locale: c.req.valid('query').locale, slug: c.req.param('slug') });
      if (!page) return c.json({ error: 'not_found' }, 404);
      c.header('Cache-Control', PUBLIC_CATALOG_CACHE);
      return c.json(page, 200);
    });
}
