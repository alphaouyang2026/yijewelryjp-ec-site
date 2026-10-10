import type { Locale } from '../../shared-kernel/locale';
import { textIn } from '../../shared-kernel/localized-text';
import type { Category } from '../domain/category';
import { priceRange, productStockStatus, type Product } from '../domain/product';
import type { StockStatus } from '../domain/stock-status';

// How the use cases show catalog data to the storefront: texts in the
// requested locale (Japanese where a translation is missing), money as yen.

/** A category, or anything else a list names: its slug and name. */
export type CatalogEntry = { slug: string; name: string };

/** A product as a list shows it: its lowest price, whether its variants' prices differ, and its stock status. */
export type ProductSummary = {
  slug: string;
  name: string;
  priceYen: number;
  priceVaries: boolean;
  stockStatus: StockStatus;
};

export function categoryEntry(category: Category, locale: Locale): CatalogEntry {
  return { slug: category.slug, name: textIn(category.name, locale) };
}

export function productSummary(product: Product, locale: Locale): ProductSummary {
  const price = priceRange(product);
  return {
    slug: product.slug,
    name: textIn(product.name, locale),
    priceYen: price.lowest.yen,
    priceVaries: price.varies,
    stockStatus: productStockStatus(product),
  };
}
