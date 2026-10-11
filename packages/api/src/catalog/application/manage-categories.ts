import type { Locale } from '../../shared-kernel/locale';
import type { LocalizedText } from '../../shared-kernel/localized-text';
import { namesEveryCategory, newCategory, type CategoryOrderEntry, type CategoryRepository } from '../domain/category';
import { adminCategory, adminCategoryEntry, type AdminCategory, type AdminCategoryEntry } from './admin-catalog-views';
import type { RuleViolation } from './manage-products';

type Deps = { categories: CategoryRepository };

/** How a change to a category ended. */
export type CategoryChange =
  | { outcome: 'changed'; category: AdminCategory }
  | { outcome: 'invalid'; violations: RuleViolation[] }
  | { outcome: 'not_found' }
  | { outcome: 'stale' };

export type ListAdminCategories = (query: { locale: Locale }) => Promise<{ categories: AdminCategoryEntry[] }>;

/** Use case: every category, in the owner's order, as the admin edits them. */
export function listAdminCategories(deps: Deps): ListAdminCategories {
  return async ({ locale }) => ({
    categories: (await deps.categories.listInDisplayOrder()).map((category) => adminCategoryEntry(category, locale)),
  });
}

export type CreateCategory = (command: { slug: string; name: LocalizedText }) => Promise<CategoryChange>;

/** Use case: the owner creates a category. It comes after every other, in the admin and in the store. */
export function createCategory(deps: Deps): CreateCategory {
  return async ({ slug, name }) => {
    const category = newCategory(slug, name);
    if ((await deps.categories.add(category)) === 'slug_taken') {
      return { outcome: 'invalid', violations: [{ path: 'slug', rule: 'slug_taken' }] };
    }
    return { outcome: 'changed', category: adminCategory(category) };
  };
}

export type RenameCategory = (command: { slug: string; name: LocalizedText; version: number }) => Promise<CategoryChange>;

/** Use case: the owner renames a category, as of its version `version`. Its slug stays: URLs depend on it. */
export function renameCategory(deps: Deps): RenameCategory {
  return async ({ slug, name, version }) => {
    const category = (await deps.categories.listInDisplayOrder()).find((c) => c.slug === slug);
    if (!category) return { outcome: 'not_found' };
    if (category.version !== version) return { outcome: 'stale' };
    const saved = await deps.categories.update({ ...category, name });
    return saved === 'stale' ? { outcome: 'stale' } : { outcome: 'changed', category: adminCategory(saved) };
  };
}

export type ReorderCategories = (command: {
  order: readonly CategoryOrderEntry[];
  locale: Locale;
}) => Promise<{ outcome: 'changed'; categories: AdminCategoryEntry[] } | { outcome: 'stale' }>;

/**
 * Use case: the owner puts the categories in a new order, giving each one's
 * version as the owner saw it. Refused as stale if the owner's list is out of
 * date: a category changed, added, or missing from it.
 */
export function reorderCategories(deps: Deps): ReorderCategories {
  return async ({ order, locale }) => {
    if (!namesEveryCategory(order, await deps.categories.listInDisplayOrder())) return { outcome: 'stale' };
    if ((await deps.categories.reorder(order)) === 'stale') return { outcome: 'stale' };
    return { outcome: 'changed', ...(await listAdminCategories(deps)({ locale })) };
  };
}
