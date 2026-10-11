import type { LocalizedText } from '../../shared-kernel/localized-text';
import type { Product } from '../domain/product';

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
