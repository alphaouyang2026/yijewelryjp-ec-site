import type { Locale } from '../../shared-kernel/locale';
import { textIn, type LocalizedText } from '../../shared-kernel/localized-text';
import type { Category } from '../domain/category';
import { priceRange, type Product } from '../domain/product';
import { categoryEntry, type CatalogEntry } from './catalog-views';

// How the use cases show the catalog to the owner in the admin: every text in
// every locale it was entered in (the forms edit each one), money as yen, and
// each product's version, which the owner's changes are made from.

/** A product as the admin's form edits it. Details the owner left out are null. */
export type AdminProduct = {
  slug: string;
  status: Product['status'];
  name: LocalizedText;
  description: LocalizedText;
  materials: LocalizedText | null;
  dimensions: LocalizedText | null;
  weight: LocalizedText | null;
  care: LocalizedText | null;
  categorySlug: string | null;
  featured: boolean;
  /** When the product was first listed (ISO 8601); null until then. */
  listedAt: string | null;
  version: number;
  variants: { sku: string; label: LocalizedText; priceYen: number; onHandStock: number; reservedStock: number }[];
};

export function adminProduct(product: Product): AdminProduct {
  return {
    slug: product.slug,
    status: product.status,
    name: product.name,
    description: product.description,
    materials: product.materials ?? null,
    dimensions: product.dimensions ?? null,
    weight: product.weight ?? null,
    care: product.care ?? null,
    categorySlug: product.categorySlug ?? null,
    featured: product.featured,
    listedAt: product.listedAt?.toISOString() ?? null,
    version: product.version,
    variants: product.variants.map((variant) => ({
      sku: variant.sku,
      label: variant.label,
      priceYen: variant.price.yen,
      onHandStock: variant.onHandStock,
      reservedStock: variant.reservedStock,
    })),
  };
}

/**
 * A product as the admin's list shows it, named in the owner's locale: its
 * status, lowest price, and stock over all its variants (on hand, and held by
 * checkouts in progress).
 */
export type AdminProductSummary = {
  slug: string;
  name: string;
  status: Product['status'];
  featured: boolean;
  category: CatalogEntry | null;
  priceYen: number;
  priceVaries: boolean;
  onHandStock: number;
  reservedStock: number;
};

export function adminProductSummary(product: Product, locale: Locale, categories: readonly Category[]): AdminProductSummary {
  const price = priceRange(product);
  const category = categories.find((c) => c.slug === product.categorySlug);
  const total = (stock: (variant: Product['variants'][number]) => number) =>
    product.variants.reduce((sum, variant) => sum + stock(variant), 0);
  return {
    slug: product.slug,
    name: textIn(product.name, locale),
    status: product.status,
    featured: product.featured,
    category: category ? categoryEntry(category, locale) : null,
    priceYen: price.lowest.yen,
    priceVaries: price.varies,
    onHandStock: total((variant) => variant.onHandStock),
    reservedStock: total((variant) => variant.reservedStock),
  };
}
