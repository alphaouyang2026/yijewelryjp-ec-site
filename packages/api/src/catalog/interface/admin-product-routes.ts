import { Hono, type Context } from 'hono';
import { invalidInput, jsonBody } from '../../interface/json-body';
import type {
  ChangeProductStatus,
  CreateProduct,
  GetAdminProduct,
  ProductChange,
  RuleViolation,
  StatusChange,
} from '../application/manage-products';
import { newProductBody, versionBody } from './admin-catalog-input';

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

/** The admin's products, behind the owner-only guard (mounted in the admin route group). */
export function adminProductRoutes(useCases: {
  createProduct: CreateProduct;
  getAdminProduct: GetAdminProduct;
  changeProductStatus: ChangeProductStatus;
}) {
  const changeStatus = async (c: Context, slug: string, change: StatusChange, version: number) =>
    changeResponse(c, await useCases.changeProductStatus({ slug, change, version }));

  return (
    new Hono()
      .post('/', jsonBody(newProductBody), async (c) => {
        const { slug, ...input } = c.req.valid('json');
        const change = await useCases.createProduct({ slug, input });
        if (change.outcome === 'invalid') return c.json(ruleErrors(change.violations), 400);
        if (change.outcome !== 'changed') throw new Error(`Creating a product cannot end ${change.outcome}`);
        return c.json(change.product, 201);
      })
      .get('/:slug', async (c) => {
        const product = await useCases.getAdminProduct(c.req.param('slug'));
        if (!product) return c.json({ error: 'not_found' } as const, 404);
        return c.json(product, 200);
      })
      // One route per status change, so each is its own typed RPC call.
      .post('/:slug/list', jsonBody(versionBody), (c) =>
        changeStatus(c, c.req.param('slug'), 'list', c.req.valid('json').version),
      )
      .post('/:slug/unlist', jsonBody(versionBody), (c) =>
        changeStatus(c, c.req.param('slug'), 'unlist', c.req.valid('json').version),
      )
      .post('/:slug/archive', jsonBody(versionBody), (c) =>
        changeStatus(c, c.req.param('slug'), 'archive', c.req.valid('json').version),
      )
      .post('/:slug/restore', jsonBody(versionBody), (c) =>
        changeStatus(c, c.req.param('slug'), 'restore', c.req.valid('json').version),
      )
  );
}
