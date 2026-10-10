import type { Locale } from '../../shared-kernel/locale';
import { textIn } from '../../shared-kernel/localized-text';
import type { CategoryRepository } from '../domain/category';
import { byNewestListing, isListed, type ProductRepository } from '../domain/product';
import { categoryEntry, productSummary, type CatalogEntry, type ProductSummary } from './catalog-views';

/** How many new arrivals the home page shows. */
const NEW_ARRIVALS_ON_HOME = 4;

/** The product the home page picks up: a summary plus its description, materials and variant labels. */
export type FeaturedProduct = ProductSummary & {
  description: string;
  materials: string | null;
  variantLabels: string[];
};

export type HomeData = {
  /** The most recently listed featured product, if any is featured. */
  featured: FeaturedProduct | null;
  newArrivals: ProductSummary[];
  categories: CatalogEntry[];
};

export type GetHomeData = (locale: Locale) => Promise<HomeData>;

/** Use case: the home page's featured product, newest listed products and categories, in `locale`. */
export function getHomeData(deps: { categories: CategoryRepository; products: ProductRepository }): GetHomeData {
  return async (locale) => {
    const [categories, products] = await Promise.all([deps.categories.listInDisplayOrder(), deps.products.all()]);
    const listed = products.filter(isListed).sort(byNewestListing);
    const featured = listed.find((product) => product.featured);

    return {
      featured: featured
        ? {
            ...productSummary(featured, locale),
            description: textIn(featured.description, locale),
            materials: featured.materials ? textIn(featured.materials, locale) : null,
            variantLabels: featured.variants.map((variant) => textIn(variant.label, locale)),
          }
        : null,
      newArrivals: listed.slice(0, NEW_ARRIVALS_ON_HOME).map((product) => productSummary(product, locale)),
      categories: categories.map((category) => categoryEntry(category, locale)),
    };
  };
}
