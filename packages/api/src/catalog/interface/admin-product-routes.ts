import { Hono } from 'hono';
import { invalidInput, jsonBody } from '../../interface/json-body';
import type { CreateProduct, GetAdminProduct, RuleViolation } from '../application/manage-products';
import { newProductBody } from './admin-catalog-input';

/** Rule violations as field errors, the same shape as the form's other errors. */
const ruleErrors = (violations: RuleViolation[]) =>
  invalidInput(violations.map(({ path, rule }) => ({ path, code: rule })));

/** The admin's products, behind the owner-only guard (mounted in the admin route group). */
export function adminProductRoutes(useCases: { createProduct: CreateProduct; getAdminProduct: GetAdminProduct }) {
  return new Hono()
    .post('/', jsonBody(newProductBody), async (c) => {
      const { slug, ...input } = c.req.valid('json');
      const change = await useCases.createProduct({ slug, input });
      if (change.outcome === 'invalid') return c.json(ruleErrors(change.violations), 400);
      return c.json(change.product, 201);
    })
    .get('/:slug', async (c) => {
      const product = await useCases.getAdminProduct(c.req.param('slug'));
      if (!product) return c.json({ error: 'not_found' } as const, 404);
      return c.json(product, 200);
    });
}
