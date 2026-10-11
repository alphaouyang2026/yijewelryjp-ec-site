import type { Locale } from '../../shared-kernel/locale';
import { textIn, type LocalizedText } from '../../shared-kernel/localized-text';
import type { Category } from '../domain/category';
import {
  allowedStatusChanges,
  OPTIONAL_PRODUCT_TEXTS,
  priceRange,
  productTexts,
  REQUIRED_PRODUCT_TEXTS,
  type Product,
  type StatusChange,
} from '../domain/product';
import { categoryEntry, type CatalogEntry } from './catalog-views';

// How the use cases show the catalog to the owner in the admin: every text in
// every locale it was entered in (the forms edit each one), money as yen, and
// each product's version, which the owner's changes are made from.

/** A product's texts as the admin edits them: details the owner left out are null. */
type AdminProductTexts = { [F in (typeof REQUIRED_PRODUCT_TEXTS)[number]]: LocalizedText } & {
  [F in (typeof OPTIONAL_PRODUCT_TEXTS)[number]]: LocalizedText | null;
};

function adminProductTexts(product: Product): AdminProductTexts {
  const texts = productTexts(product);
  const details = Object.fromEntries(OPTIONAL_PRODUCT_TEXTS.map((field) => [field, texts[field] ?? null]));
  return { ...texts, ...details } as AdminProductTexts;
}

/** A product as the admin's form edits it. */
export type AdminProduct = AdminProductTexts & {
  slug: string;
  status: Product['status'];
  /** What the owner can do to the status now, so the admin offers only that. */
  statusChanges: StatusChange[];
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
    statusChanges: allowedStatusChanges(product),
    ...adminProductTexts(product),
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

/** A category as the admin edits it: its name in every locale entered, and its version. */
export type AdminCategory = { slug: string; name: LocalizedText; version: number };

/** A category in the admin's list: also named in the owner's locale. */
export type AdminCategoryEntry = AdminCategory & { displayName: string };

export function adminCategory(category: Category): AdminCategory {
  return { slug: category.slug, name: category.name, version: category.version };
}

export function adminCategoryEntry(category: Category, locale: Locale): AdminCategoryEntry {
  return { slug: category.slug, displayName: textIn(category.name, locale), name: category.name, version: category.version };
}
