import type { Locale } from '../../shared-kernel/locale';
import { textIn, type LocalizedText } from '../../shared-kernel/localized-text';
import type { CategoryRepository } from '../domain/category';
import { isListed, productStockStatus, variantStockStatus, type ProductRepository } from '../domain/product';
import type { StockStatus } from '../domain/stock-status';
import { categoryEntry, type CatalogEntry } from './catalog-views';

export type ProductDetail = {
  slug: string;
  name: string;
  description: string;
  /** Details the owner may leave out are null then. */
  materials: string | null;
  dimensions: string | null;
  weight: string | null;
  care: string | null;
  category: CatalogEntry | null;
  stockStatus: StockStatus;
  variants: { sku: string; label: string; priceYen: number; stockStatus: StockStatus }[];
};

export type ProductPage = {
  product: ProductDetail;
  /** Every category, for the site's navigation. */
  categories: CatalogEntry[];
};

export type GetProduct = (query: { locale: Locale; slug: string }) => Promise<ProductPage | undefined>;

/** Use case: a listed product's details. Undefined for drafts, archived and unknown products. */
export function getProduct(deps: { categories: CategoryRepository; products: ProductRepository }): GetProduct {
  return async ({ locale, slug }) => {
    const [categories, product] = await Promise.all([
      deps.categories.listInDisplayOrder(),
      deps.products.bySlug(slug),
    ]);
    if (!product || !isListed(product)) return undefined;

    const optional = (text: LocalizedText | undefined) => (text ? textIn(text, locale) : null);
    const category = categories.find((c) => c.slug === product.categorySlug);

    return {
      product: {
        slug: product.slug,
        name: textIn(product.name, locale),
        description: textIn(product.description, locale),
        materials: optional(product.materials),
        dimensions: optional(product.dimensions),
        weight: optional(product.weight),
        care: optional(product.care),
        category: category ? categoryEntry(category, locale) : null,
        stockStatus: productStockStatus(product),
        variants: product.variants.map((variant) => ({
          sku: variant.sku,
          label: textIn(variant.label, locale),
          priceYen: variant.price.yen,
          stockStatus: variantStockStatus(variant),
        })),
      },
      categories: categories.map((c) => categoryEntry(c, locale)),
    };
  };
}
