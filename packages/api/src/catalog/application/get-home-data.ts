import type { Locale } from '../../shared-kernel/locale';
import { textIn } from '../../shared-kernel/localized-text';
import type { Category, CategoryRepository } from '../domain/category';
import type { Product, ProductRepository } from '../domain/product';

/** How many new arrivals the home page shows. */
const NEW_ARRIVALS_ON_HOME = 4;

/** A product or category as a list shows it: the slug that identifies it and its name in the requested locale. */
export type CatalogEntry = { slug: string; name: string };

export type HomeData = {
  newArrivals: CatalogEntry[];
  categories: CatalogEntry[];
};

export type GetHomeData = (locale: Locale) => Promise<HomeData>;

/** Use case: the home page's new arrivals and categories, with their names in `locale`. */
export function getHomeData(deps: { categories: CategoryRepository; products: ProductRepository }): GetHomeData {
  return async (locale) => {
    const [categories, newArrivals] = await Promise.all([
      deps.categories.listInDisplayOrder(),
      deps.products.listNewArrivals(NEW_ARRIVALS_ON_HOME),
    ]);
    const toEntry = catalogEntryIn(locale);
    return { newArrivals: newArrivals.map(toEntry), categories: categories.map(toEntry) };
  };
}

/** Maps a product or category to its CatalogEntry, with its name in `locale`. */
function catalogEntryIn(locale: Locale) {
  return ({ slug, name }: Product | Category): CatalogEntry => ({ slug, name: textIn(name, locale) });
}
