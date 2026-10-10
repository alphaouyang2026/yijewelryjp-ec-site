import type { Locale } from '../../shared-kernel/locale';
import type { CategoryRepository } from '../domain/category';
import { byNewestListing, isListed, priceRange, type Product, type ProductRepository } from '../domain/product';
import { categoryEntry, productSummary, type CatalogEntry, type ProductSummary } from './catalog-views';

export const PRODUCT_SORTS = ['newest', 'price_asc', 'price_desc'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export type ProductList = {
  products: ProductSummary[];
  /** The category the list is limited to, if any. */
  category: CatalogEntry | null;
  /** Every category, for the site's navigation. */
  categories: CatalogEntry[];
};

export type ListProducts = (query: {
  locale: Locale;
  sort: ProductSort;
  /** Limits the list to one category. */
  categorySlug?: string;
}) => Promise<ProductList | undefined>;

const lowestPrice = (product: Product) => priceRange(product).lowest.yen;

/** Ties are broken by the newest listing, so the order is stable. */
const ORDER: Record<ProductSort, (a: Product, b: Product) => number> = {
  newest: byNewestListing,
  price_asc: (a, b) => lowestPrice(a) - lowestPrice(b) || byNewestListing(a, b),
  price_desc: (a, b) => lowestPrice(b) - lowestPrice(a) || byNewestListing(a, b),
};

/**
 * Use case: the listed products, all or one category's, in `sort` order.
 * Undefined when the category does not exist.
 */
export function listProducts(deps: { categories: CategoryRepository; products: ProductRepository }): ListProducts {
  return async ({ locale, sort, categorySlug }) => {
    const [categories, products] = await Promise.all([deps.categories.listInDisplayOrder(), deps.products.all()]);

    const category = categorySlug === undefined ? undefined : categories.find((c) => c.slug === categorySlug);
    if (categorySlug !== undefined && !category) return undefined;

    const listed = products
      .filter(isListed)
      .filter((product) => category === undefined || product.categorySlug === category.slug)
      .sort(ORDER[sort]);

    return {
      products: listed.map((product) => productSummary(product, locale)),
      category: category ? categoryEntry(category, locale) : null,
      categories: categories.map((c) => categoryEntry(c, locale)),
    };
  };
}
