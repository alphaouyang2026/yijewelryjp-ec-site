import type { Locale } from '../../shared-kernel/locale';
import type { LocalizedText } from '../../shared-kernel/localized-text';
import {
  namesEveryCategory,
  newCategory,
  positionsOfUnknownCategories,
  type CategoryRepository,
} from '../domain/category';
import type { VersionedSlug } from '../domain/versioned-slug';
import { adminCategory, adminCategoryEntry, type AdminCategory, type AdminCategoryEntry } from './admin-catalog-views';
import type { CatalogChange } from './catalog-changes';

type Deps = { categories: CategoryRepository };

/** How a change to a category ended. */
export type CategoryChange = CatalogChange<AdminCategory, 'invalid' | 'not_found' | 'stale'>;

export type ListAdminCategories = (query: { locale: Locale }) => Promise<{ categories: AdminCategoryEntry[] }>;

/** Use case: every category, in the owner's order, as the admin edits them. */
export function listAdminCategories(deps: Deps): ListAdminCategories {
  return async ({ locale }) => ({
    categories: (await deps.categories.listInDisplayOrder()).map((category) => adminCategoryEntry(category, locale)),
  });
}

export type CreateCategory = (command: {
  slug: string;
  name: LocalizedText;
}) => Promise<CatalogChange<AdminCategory, 'invalid'>>;

/** Use case: the owner creates a category. It comes after every other, in the admin and in the store. */
export function createCategory(deps: Deps): CreateCategory {
  return async ({ slug, name }) => {
    const category = newCategory(slug, name);
    if ((await deps.categories.add(category)) === 'slug_taken') {
      return { outcome: 'invalid', violations: [{ path: 'slug', rule: 'slug_taken' }] };
    }
    return { outcome: 'changed', changed: adminCategory(category) };
  };
}

export type RenameCategory = (command: { category: VersionedSlug; name: LocalizedText }) => Promise<CategoryChange>;

/** Use case: the owner renames a category, as of the version the owner saw. Its slug stays: URLs depend on it. */
export function renameCategory(deps: Deps): RenameCategory {
  return async ({ category: seen, name }) => {
    const category = (await deps.categories.listInDisplayOrder()).find((c) => c.slug === seen.slug);
    if (!category) return { outcome: 'not_found' };
    if (category.version !== seen.version) return { outcome: 'stale' };
    const saved = await deps.categories.update({ ...category, name });
    return saved === 'stale' ? { outcome: 'stale' } : { outcome: 'changed', changed: adminCategory(saved) };
  };
}

export type ReorderCategories = (command: {
  order: readonly VersionedSlug[];
  locale: Locale;
}) => Promise<CatalogChange<{ categories: AdminCategoryEntry[] }, 'invalid' | 'stale'>>;

/**
 * Use case: the owner puts the categories in a new order, giving each one's
 * version as the owner saw it. Refused as invalid if it names a category there
 * is not, and as stale if the owner's list is out of date: a category
 * changed, added, or missing from it.
 */
export function reorderCategories(deps: Deps): ReorderCategories {
  return async ({ order, locale }) => {
    const categories = await deps.categories.listInDisplayOrder();
    const unknown = positionsOfUnknownCategories(order, categories);
    if (unknown.length > 0) {
      return {
        outcome: 'invalid',
        violations: unknown.map((position) => ({ path: `categories.${position}.slug`, rule: 'unknown_category' })),
      };
    }
    if (!namesEveryCategory(order, categories)) return { outcome: 'stale' };
    if ((await deps.categories.reorder(order)) === 'stale') return { outcome: 'stale' };
    return { outcome: 'changed', changed: await listAdminCategories(deps)({ locale }) };
  };
}
