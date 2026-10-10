import type { LocalizedText } from '../../shared-kernel/localized-text';
import type { Money } from '../../shared-kernel/money';
import { stockStatusOf, type StockStatus } from './stock-status';

/** Draft: still being prepared. Listed: on sale. Archived: no longer sold, kept for order history. */
export type ProductStatus = 'draft' | 'listed' | 'archived';

/** A buyable version of a product, such as one ring size or chain length. */
export type Variant = {
  readonly sku: string;
  /** What tells this variant apart, e.g. 9号 or 45cm. */
  readonly label: LocalizedText;
  /** Tax-inclusive. */
  readonly price: Money;
  readonly onHandStock: number;
  /** Held by checkouts in progress (from the checkout ticket on). */
  readonly reservedStock: number;
};

/** A design shown on the site, with at least one variant. */
export type Product = {
  readonly slug: string;
  readonly status: ProductStatus;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly materials?: LocalizedText;
  readonly dimensions?: LocalizedText;
  readonly weight?: LocalizedText;
  readonly care?: LocalizedText;
  readonly categorySlug?: string;
  /** Picked by the owner for the home page. */
  readonly featured: boolean;
  /** When the product was first listed; new arrivals are ordered by it. */
  readonly listedAt?: Date;
  readonly variants: readonly Variant[];
};

export interface ProductRepository {
  /** Every product, in any status and order. The catalog is small (well under 500 products). */
  all(): Promise<Product[]>;
  bySlug(slug: string): Promise<Product | undefined>;
}

/** Customers see listed products only; drafts and archived products never appear. */
export function isListed(product: Product): boolean {
  return product.status === 'listed';
}

/** On-hand stock less reserved stock, never negative. */
export function availableStock(variant: Variant): number {
  return Math.max(0, variant.onHandStock - variant.reservedStock);
}

/** The product's stock status over all its variants: sold out only when every variant is. */
export function productStockStatus(product: Product): StockStatus {
  return stockStatusOf(product.variants.reduce((sum, variant) => sum + availableStock(variant), 0));
}

export function variantStockStatus(variant: Variant): StockStatus {
  return stockStatusOf(availableStock(variant));
}

/** The lowest variant price, and whether the variants' prices differ. */
export function priceRange(product: Product): { lowest: Money; varies: boolean } {
  const prices = product.variants.map((variant) => variant.price.yen);
  const lowest = Math.min(...prices);
  return { lowest: { yen: lowest }, varies: prices.some((price) => price !== lowest) };
}

/** Newest listing first; products listed at the same time by slug, so the order is stable. */
export function byNewestListing(a: Product, b: Product): number {
  return (b.listedAt?.getTime() ?? 0) - (a.listedAt?.getTime() ?? 0) || a.slug.localeCompare(b.slug);
}
