import type { LocalizedText } from '../../shared-kernel/localized-text';

/** A group of products, such as rings or necklaces, that the site's navigation lists in the owner's order. */
export type Category = {
  readonly slug: string;
  readonly name: LocalizedText;
  /**
   * Which stored version of the category this is: 1 when created, one more
   * with each change (renaming, or moving in the order). A change is saved
   * only onto the version it was made from.
   */
  readonly version: number;
};

/** A category's place in the order, as the owner saw it: its slug and version. */
export type CategoryOrderEntry = { readonly slug: string; readonly version: number };

export interface CategoryRepository {
  /** Every category, in the order the shop owner arranged them. */
  listInDisplayOrder(): Promise<Category[]>;
  /** Stores a new category after every other; 'slug_taken' (and nothing stored) if a category already has its slug. */
  add(category: Category): Promise<'added' | 'slug_taken'>;
  /**
   * Stores `category`'s name as the next version and returns it as stored;
   * 'stale' (and nothing stored) if the stored category is no longer at
   * `category.version`.
   */
  update(category: Category): Promise<Category | 'stale'>;
  /**
   * Arranges the categories in `order`, each moving to its next version, all
   * or none: 'stale' (and nothing changed) if any is no longer at the version
   * given. `order` names every category once.
   */
  reorder(order: readonly CategoryOrderEntry[]): Promise<'reordered' | 'stale'>;
}

/** A new category, at version 1. */
export function newCategory(slug: string, name: LocalizedText): Category {
  return { slug, name, version: 1 };
}

/**
 * Whether `order` names exactly the categories there are, each once. An order
 * made before a category was added (or that leaves one out) does not.
 */
export function namesEveryCategory(order: readonly CategoryOrderEntry[], categories: readonly Category[]): boolean {
  const slugs = new Set(order.map((entry) => entry.slug));
  return (
    slugs.size === order.length &&
    order.length === categories.length &&
    categories.every((category) => slugs.has(category.slug))
  );
}
