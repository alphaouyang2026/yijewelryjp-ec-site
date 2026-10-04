import type { Locale } from '../../shared-kernel/locale';
import { textIn } from '../../shared-kernel/localized-text';
import type { CategoryRepository } from '../domain/category';
import type { ProductRepository } from '../domain/product';

/** How many new arrivals the home page shows. */
const NEW_ARRIVALS_ON_HOME = 4;

export type HomeData = {
  newArrivals: { slug: string; name: string }[];
  categories: { slug: string; name: string }[];
};

export type GetHomeData = (locale: Locale) => Promise<HomeData>;

/** Use case: the home page's new arrivals and categories, with their names in `locale`. */
export function getHomeData(deps: { categories: CategoryRepository; products: ProductRepository }): GetHomeData {
  return async (locale) => {
    const [categories, newArrivals] = await Promise.all([
      deps.categories.listInDisplayOrder(),
      deps.products.listNewArrivals(NEW_ARRIVALS_ON_HOME),
    ]);
    return {
      newArrivals: newArrivals.map((product) => ({ slug: product.slug, name: textIn(product.name, locale) })),
      categories: categories.map((category) => ({ slug: category.slug, name: textIn(category.name, locale) })),
    };
  };
}
