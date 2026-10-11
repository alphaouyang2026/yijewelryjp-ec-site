import { Hono } from 'hono';
import { jsonBody } from '../../interface/json-body';
import type { CreateProduct, GetAdminProduct } from '../application/manage-products';
import { newProductBody } from './admin-catalog-input';

/** The admin's products, behind the owner-only guard (mounted in the admin route group). */
export function adminProductRoutes(useCases: { createProduct: CreateProduct; getAdminProduct: GetAdminProduct }) {
  return new Hono()
    .post('/', jsonBody(newProductBody), async (c) => {
      const { slug, ...input } = c.req.valid('json');
      return c.json(await useCases.createProduct({ slug, input }), 201);
    })
    .get('/:slug', async (c) => {
      const product = await useCases.getAdminProduct(c.req.param('slug'));
      if (!product) return c.json({ error: 'not_found' } as const, 404);
      return c.json(product, 200);
    });
}
