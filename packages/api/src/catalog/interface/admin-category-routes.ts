import { Hono, type Context } from 'hono';
import * as z from 'zod';
import { invalidInput, jsonBody } from '../../interface/json-body';
import { localeQuery } from '../../interface/locale-query';
import type {
  CategoryChange,
  CreateCategory,
  ListAdminCategories,
  RenameCategory,
  ReorderCategories,
} from '../application/manage-categories';
import { categoryName, slug, version } from './admin-catalog-input';

const newCategoryBody = z.object({ slug, name: categoryName });
const renameBody = z.object({ name: categoryName, version });

/** The new order: every category once, each with the version the owner saw. */
const orderBody = z.object({
  categories: z
    .array(z.object({ slug: z.string(), version }), { error: 'invalid' })
    .refine((order) => new Set(order.map((entry) => entry.slug)).size === order.length, { error: 'invalid' }),
});

/** The answer to a change of a category: the category as now stored (`status`), or why nothing changed. */
function changeResponse(c: Context, change: CategoryChange, status: 200 | 201) {
  switch (change.outcome) {
    case 'changed':
      return c.json(change.category, status);
    case 'invalid':
      return c.json(invalidInput(change.violations.map(({ path, rule }) => ({ path, code: rule }))), 400);
    case 'not_found':
      return c.json({ error: 'not_found' } as const, 404);
    case 'stale':
      return c.json({ error: 'stale_version' } as const, 409);
  }
}

/** The admin's categories, behind the owner-only guard (mounted in the admin route group). */
export function adminCategoryRoutes(useCases: {
  listAdminCategories: ListAdminCategories;
  createCategory: CreateCategory;
  renameCategory: RenameCategory;
}) {
  return new Hono()
    .get('/', localeQuery, async (c) => c.json(await useCases.listAdminCategories(c.req.valid('query')), 200))
    .post('/', jsonBody(newCategoryBody), async (c) =>
      changeResponse(c, await useCases.createCategory(c.req.valid('json')), 201),
    )
    .put('/:slug', jsonBody(renameBody), async (c) =>
      changeResponse(c, await useCases.renameCategory({ slug: c.req.param('slug'), ...c.req.valid('json') }), 200),
    );
}

/** The categories' order (its own path, so no category slug can clash with it). */
export function categoryOrderRoutes(useCases: { reorderCategories: ReorderCategories }) {
  return new Hono().put('/', localeQuery, jsonBody(orderBody), async (c) => {
    const result = await useCases.reorderCategories({
      order: c.req.valid('json').categories,
      locale: c.req.valid('query').locale,
    });
    if (result.outcome === 'stale') return c.json({ error: 'stale_version' } as const, 409);
    return c.json({ categories: result.categories }, 200);
  });
}
