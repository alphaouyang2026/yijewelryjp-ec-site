import { Hono, type Context } from 'hono';
import * as z from 'zod';
import { localeQueryWith } from '../../interface/locale-query';
import {
  PRODUCT_STATUSES,
  type ChangeProductStatus,
  type CreateProduct,
  type EditProduct,
  type GetAdminProduct,
  type ListAdminProducts,
  type StatusChange,
  type VersionedSlug,
} from '../application/manage-products';
import { catalogJsonBody, newProductBody, productEditBody, slugParam, versionBody } from './admin-catalog-input';
import { changeResponse } from './catalog-change-response';

const productListQuery = localeQueryWith({ status: z.enum(PRODUCT_STATUSES).optional() });

/** The admin's products, behind the owner-only guard (mounted in the admin route group). */
export function adminProductRoutes(useCases: {
  listAdminProducts: ListAdminProducts;
  createProduct: CreateProduct;
  getAdminProduct: GetAdminProduct;
  editProduct: EditProduct;
  changeProductStatus: ChangeProductStatus;
}) {
  const changeStatus = async (c: Context, product: VersionedSlug, change: StatusChange) =>
    changeResponse(c, await useCases.changeProductStatus({ product, change }), 200);

  return (
    new Hono()
      .get('/', productListQuery, async (c) => c.json(await useCases.listAdminProducts(c.req.valid('query')), 200))
      .post('/', catalogJsonBody(newProductBody), async (c) => {
        const { slug, ...input } = c.req.valid('json');
        return changeResponse(c, await useCases.createProduct({ slug, input }), 201);
      })
      .get('/:slug', slugParam, async (c) => {
        const product = await useCases.getAdminProduct(c.req.valid('param').slug);
        if (!product) return c.json({ error: 'not_found' } as const, 404);
        return c.json(product, 200);
      })
      .put('/:slug', slugParam, catalogJsonBody(productEditBody), async (c) => {
        const { version, ...input } = c.req.valid('json');
        return changeResponse(
          c,
          await useCases.editProduct({ product: { slug: c.req.valid('param').slug, version }, input }),
          200,
        );
      })
      // One route per status change, so each is its own typed RPC call.
      .post('/:slug/list', slugParam, catalogJsonBody(versionBody), (c) =>
        changeStatus(c, { slug: c.req.valid('param').slug, version: c.req.valid('json').version }, 'list'),
      )
      .post('/:slug/unlist', slugParam, catalogJsonBody(versionBody), (c) =>
        changeStatus(c, { slug: c.req.valid('param').slug, version: c.req.valid('json').version }, 'unlist'),
      )
      .post('/:slug/archive', slugParam, catalogJsonBody(versionBody), (c) =>
        changeStatus(c, { slug: c.req.valid('param').slug, version: c.req.valid('json').version }, 'archive'),
      )
      .post('/:slug/restore', slugParam, catalogJsonBody(versionBody), (c) =>
        changeStatus(c, { slug: c.req.valid('param').slug, version: c.req.valid('json').version }, 'restore'),
      )
  );
}
