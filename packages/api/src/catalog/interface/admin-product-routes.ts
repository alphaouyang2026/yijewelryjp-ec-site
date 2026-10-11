import { Hono, type Context } from 'hono';
import * as z from 'zod';
import { invalidInput, jsonBody } from '../../interface/json-body';
import { localeQueryWith } from '../../interface/locale-query';
import {
  PRODUCT_STATUSES,
  type ChangeProductStatus,
  type CreateProduct,
  type EditProduct,
  type GetAdminProduct,
  type ListAdminProducts,
  type ProductChange,
  type RuleViolation,
  type StatusChange,
} from '../application/manage-products';
import { newProductBody, productEditBody, slugParam, versionBody } from './admin-catalog-input';

/** Rule violations as field errors, the same shape as the form's other errors. */
const ruleErrors = (violations: RuleViolation[]) =>
  invalidInput(violations.map(({ path, rule }) => ({ path, code: rule })));

/** The answer to a change of an existing product: the product as now stored, or why nothing changed. */
function changeResponse(c: Context, change: ProductChange) {
  switch (change.outcome) {
    case 'changed':
      return c.json(change.product, 200);
    case 'invalid':
      return c.json(ruleErrors(change.violations), 400);
    case 'not_found':
      return c.json({ error: 'not_found' } as const, 404);
    case 'stale':
      return c.json({ error: 'stale_version' } as const, 409);
    case 'invalid_status_transition':
      return c.json({ error: 'invalid_status_transition' } as const, 409);
  }
}

const productListQuery = localeQueryWith({ status: z.enum(PRODUCT_STATUSES).optional() });

/** The admin's products, behind the owner-only guard (mounted in the admin route group). */
export function adminProductRoutes(useCases: {
  listAdminProducts: ListAdminProducts;
  createProduct: CreateProduct;
  getAdminProduct: GetAdminProduct;
  editProduct: EditProduct;
  changeProductStatus: ChangeProductStatus;
}) {
  const changeStatus = async (c: Context, slug: string, change: StatusChange, version: number) =>
    changeResponse(c, await useCases.changeProductStatus({ slug, change, version }));

  return (
    new Hono()
      .get('/', productListQuery, async (c) => c.json(await useCases.listAdminProducts(c.req.valid('query')), 200))
      .post('/', jsonBody(newProductBody), async (c) => {
        const { slug, ...input } = c.req.valid('json');
        const change = await useCases.createProduct({ slug, input });
        if (change.outcome === 'invalid') return c.json(ruleErrors(change.violations), 400);
        if (change.outcome !== 'changed') throw new Error(`Creating a product cannot end ${change.outcome}`);
        return c.json(change.product, 201);
      })
      .get('/:slug', slugParam, async (c) => {
        const product = await useCases.getAdminProduct(c.req.valid('param').slug);
        if (!product) return c.json({ error: 'not_found' } as const, 404);
        return c.json(product, 200);
      })
      .put('/:slug', slugParam, jsonBody(productEditBody), async (c) => {
        const { version, ...input } = c.req.valid('json');
        return changeResponse(c, await useCases.editProduct({ slug: c.req.valid('param').slug, input, version }));
      })
      // One route per status change, so each is its own typed RPC call.
      .post('/:slug/list', slugParam, jsonBody(versionBody), (c) =>
        changeStatus(c, c.req.valid('param').slug, 'list', c.req.valid('json').version),
      )
      .post('/:slug/unlist', slugParam, jsonBody(versionBody), (c) =>
        changeStatus(c, c.req.valid('param').slug, 'unlist', c.req.valid('json').version),
      )
      .post('/:slug/archive', slugParam, jsonBody(versionBody), (c) =>
        changeStatus(c, c.req.valid('param').slug, 'archive', c.req.valid('json').version),
      )
      .post('/:slug/restore', slugParam, jsonBody(versionBody), (c) =>
        changeStatus(c, c.req.valid('param').slug, 'restore', c.req.valid('json').version),
      )
  );
}
