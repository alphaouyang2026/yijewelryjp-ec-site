import { Hono } from 'hono';
import * as z from 'zod';
import { jsonBody } from '../../interface/json-body';
import { localeQuery } from '../../interface/locale-query';
import type {
  CreateCategory,
  ListAdminCategories,
  RenameCategory,
  ReorderCategories,
} from '../application/manage-categories';
import { categoryName, categoryOrderBody, slug, slugParam, version } from './admin-catalog-input';
import { changeResponse } from './catalog-change-response';

const newCategoryBody = z.object({ slug, name: categoryName });
const renameBody = z.object({ name: categoryName, version });

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
    .put('/:slug', slugParam, jsonBody(renameBody), async (c) =>
      changeResponse(c, await useCases.renameCategory({ ...c.req.valid('param'), ...c.req.valid('json') }), 200),
    );
}

/** The categories' order (its own path, so no category slug can clash with it). */
export function categoryOrderRoutes(useCases: { reorderCategories: ReorderCategories }) {
  return new Hono().put('/', localeQuery, jsonBody(categoryOrderBody), async (c) =>
    changeResponse(
      c,
      await useCases.reorderCategories({ order: c.req.valid('json').categories, locale: c.req.valid('query').locale }),
      200,
    ),
  );
}
