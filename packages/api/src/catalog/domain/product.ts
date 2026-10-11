import type { LocalizedText } from '../../shared-kernel/localized-text';
import type { Money } from '../../shared-kernel/money';
import { stockStatusOf, type StockStatus } from './stock-status';

/** Draft: still being prepared. Listed: on sale. Archived: no longer sold, kept for order history. */
export const PRODUCT_STATUSES = ['draft', 'listed', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

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
  /** When the owner last changed the product, if ever. */
  readonly updatedAt?: Date;
  readonly variants: readonly Variant[];
  /**
   * Which stored version of the product this is: 1 when created, one more with
   * each change. A change is saved only onto the version it was made from, so
   * an owner editing an outdated copy cannot overwrite a newer one.
   */
  readonly version: number;
};

/** What the owner enters for a product: everything but its slug, status, listing time and reserved stock. */
export type ProductContent = Pick<
  Product,
  'name' | 'description' | 'materials' | 'dimensions' | 'weight' | 'care' | 'categorySlug' | 'featured'
> & {
  readonly variants: readonly VariantContent[];
};

/** What the owner enters for a variant; its reserved stock is the checkouts'. */
export type VariantContent = Omit<Variant, 'reservedStock'>;

export interface ProductRepository {
  /** Every product, in any status and order. The catalog is small (well under 500 products). */
  all(): Promise<Product[]>;
  bySlug(slug: string): Promise<Product | undefined>;
  /** Stores a new product; 'slug_taken' (and nothing stored) if a product already has its slug. */
  add(product: Product): Promise<'added' | 'slug_taken'>;
  /**
   * Stores `product`, changed from the stored version `product.version`, as
   * the next version, and returns it as stored. 'stale' (and nothing stored)
   * if the stored product is no longer at that version: someone changed it
   * since it was read.
   */
  update(product: Product): Promise<Product | 'stale'>;
}

/** A new product, as a draft at version 1, with `content` and nothing reserved. */
export function newProduct(slug: string, content: ProductContent, now: Date): Product {
  return {
    ...content,
    slug,
    status: 'draft',
    updatedAt: now,
    variants: content.variants.map((variant) => ({ ...variant, reservedStock: 0 })),
    version: 1,
  };
}

/**
 * The product with the owner's new `content` at `now`. Variants are matched by
 * SKU: one the owner keeps keeps its reserved stock, a new one has none. A
 * variant that checkouts in progress hold stock of cannot be removed, so the
 * revision is refused then. The slug never changes: URLs depend on it.
 */
export function reviseProduct(
  product: Product,
  content: ProductContent,
  now: Date,
): Product | 'variant_has_reserved_stock' {
  const reserved = new Map(product.variants.map((variant) => [variant.sku, variant.reservedStock]));
  const kept = new Set(content.variants.map((variant) => variant.sku));
  if (product.variants.some((variant) => variant.reservedStock > 0 && !kept.has(variant.sku))) {
    return 'variant_has_reserved_stock';
  }
  return {
    ...product,
    name: content.name,
    description: content.description,
    materials: content.materials,
    dimensions: content.dimensions,
    weight: content.weight,
    care: content.care,
    categorySlug: content.categorySlug,
    featured: content.featured,
    variants: content.variants.map((variant) => ({ ...variant, reservedStock: reserved.get(variant.sku) ?? 0 })),
    updatedAt: now,
  };
}

/** What the owner can do to a product's status. There is no deleting: a product no longer sold is archived. */
export type StatusChange = 'list' | 'unlist' | 'archive' | 'restore';

const TRANSITIONS: Record<StatusChange, { from: readonly ProductStatus[]; to: ProductStatus }> = {
  list: { from: ['draft'], to: 'listed' },
  unlist: { from: ['listed'], to: 'draft' },
  archive: { from: ['draft', 'listed'], to: 'archived' },
  restore: { from: ['archived'], to: 'draft' },
};

/**
 * The product after `change` at `now`, or undefined if its status does not
 * allow it. Listing: draft to listed, and the first listing sets when it was
 * listed (new arrivals are ordered by it). Unlisting: listed to draft.
 * Archiving: draft or listed to archived. Restoring: archived to draft.
 */
export function changeStatus(product: Product, change: StatusChange, now: Date): Product | undefined {
  const { from, to } = TRANSITIONS[change];
  if (!from.includes(product.status)) return undefined;
  return {
    ...product,
    status: to,
    listedAt: to === 'listed' ? (product.listedAt ?? now) : product.listedAt,
    updatedAt: now,
  };
}

/**
 * SKUs are unique across the whole catalog. The positions in `variants` whose
 * SKU is taken: by an earlier variant in the list, or by a variant of any of
 * `others` (every other product).
 */
export function positionsWithTakenSku(variants: readonly { sku: string }[], others: readonly Product[]): number[] {
  const taken = new Set(others.flatMap((product) => product.variants.map((variant) => variant.sku)));
  const positions: number[] = [];
  variants.forEach(({ sku }, position) => {
    if (taken.has(sku)) positions.push(position);
    taken.add(sku);
  });
  return positions;
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

/** The most recently changed by the owner first; products never changed in the admin last, by slug. */
export function byLatestChange(a: Product, b: Product): number {
  return (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0) || a.slug.localeCompare(b.slug);
}

/** Newest listing first; products listed at the same time by slug, so the order is stable. */
export function byNewestListing(a: Product, b: Product): number {
  return (b.listedAt?.getTime() ?? 0) - (a.listedAt?.getTime() ?? 0) || a.slug.localeCompare(b.slug);
}
