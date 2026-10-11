import type { Locale } from '../../shared-kernel/locale';
import { textIn } from '../../shared-kernel/localized-text';
import type { Category } from '../domain/category';
import type { ProductPhoto } from '../domain/photo';
import { mainPhoto, priceRange, productStockStatus, type Product } from '../domain/product';
import type { StockStatus } from '../domain/stock-status';

// How the use cases show catalog data to the storefront: texts in the
// requested locale (Japanese where a translation is missing), money as yen.

/** A category, or anything else a list names: its slug and name. */
export type CatalogEntry = { slug: string; name: string };

/** A photo as the storefront shows it: where it is served, and its alt text in the requested locale. */
export type PhotoView = { url: string; alt: string };

/**
 * A product as a list shows it: its main photo (null if it has none), its
 * lowest price, whether its variants' prices differ, and its stock status.
 */
export type ProductSummary = {
  slug: string;
  name: string;
  photo: PhotoView | null;
  priceYen: number;
  priceVaries: boolean;
  stockStatus: StockStatus;
};

export function categoryEntry(category: Category, locale: Locale): CatalogEntry {
  return { slug: category.slug, name: textIn(category.name, locale) };
}

/**
 * Where a photo is served: on the site's own domain, at its key, which starts
 * with images/ (CloudFront serves /images/* from the bucket).
 */
export function photoUrl(key: string): string {
  return `/${key}`;
}

export function photoView(photo: ProductPhoto, locale: Locale): PhotoView {
  return { url: photoUrl(photo.key), alt: textIn(photo.alt, locale) };
}

export function productSummary(product: Product, locale: Locale): ProductSummary {
  const price = priceRange(product);
  const photo = mainPhoto(product);
  return {
    slug: product.slug,
    name: textIn(product.name, locale),
    photo: photo ? photoView(photo, locale) : null,
    priceYen: price.lowest.yen,
    priceVaries: price.varies,
    stockStatus: productStockStatus(product),
  };
}
