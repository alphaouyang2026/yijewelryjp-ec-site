import type { LocalizedText } from '../../shared-kernel/localized-text';
import type { Money } from '../../shared-kernel/money';
import type { UnitOfWork } from '../../shared-kernel/unit-of-work';
import type { ProductPhoto } from './photo';
import { stockStatusOf, type StockStatus } from './stock-status';

/** Draft: still being prepared. Listed: on sale. Archived: no longer sold, kept for order history. */
export const PRODUCT_STATUSES = ['draft', 'listed', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/** A buyable version of a product, such as one ring size or chain length. */
export type Variant = {
  readonly sku: string;
  /** What tells this variant apart, e.g. 9号 or 45cm. */
  readonly label: LocalizedText;
  /** Tax-inclusive, at most MAX_PRICE_YEN. */
  readonly price: Money;
  readonly onHandStock: number;
  /** Held by checkouts in progress (from the checkout ticket on). */
  readonly reservedStock: number;
};

/** The highest price a variant can have: the most Stripe charges in one payment in yen. */
export const MAX_PRICE_YEN = 99_999_999;

/** The texts every product has, each kept per locale. */
export const REQUIRED_PRODUCT_TEXTS = ['name', 'description'] as const;
/** The details, each kept per locale, that the owner may leave out; customers see those entered. */
export const OPTIONAL_PRODUCT_TEXTS = ['materials', 'dimensions', 'weight', 'care'] as const;

/** Every text of a product, the one list the layers' product texts follow. */
export const PRODUCT_TEXT_FIELDS = [...REQUIRED_PRODUCT_TEXTS, ...OPTIONAL_PRODUCT_TEXTS] as const;
export type ProductTextField = (typeof PRODUCT_TEXT_FIELDS)[number];

/** A product's texts: its name and description, and the details the owner entered. */
export type ProductTexts = { readonly [F in (typeof REQUIRED_PRODUCT_TEXTS)[number]]: LocalizedText } & {
  readonly [F in (typeof OPTIONAL_PRODUCT_TEXTS)[number]]?: LocalizedText;
};

/**
 * Just the texts of `source`, with every detail present (undefined where left
 * out), so spreading them over a product replaces each of its texts.
 */
export function productTexts(source: ProductTexts): ProductTexts {
  return Object.fromEntries(PRODUCT_TEXT_FIELDS.map((field) => [field, source[field]])) as ProductTexts;
}

/** A design shown on the site, with at least one variant. */
export type Product = ProductTexts & {
  readonly slug: string;
  readonly status: ProductStatus;
  readonly categorySlug?: string;
  /** Picked by the owner for the home page. */
  readonly featured: boolean;
  /** When the product was first listed; new arrivals are ordered by it. */
  readonly listedAt?: Date;
  /** When the owner last changed the product, if ever. */
  readonly updatedAt?: Date;
  readonly variants: readonly Variant[];
  /** In the owner's order; the first is the one lists and the home page show. */
  readonly photos: readonly ProductPhoto[];
  /**
   * Which stored version of the product this is: 1 when created (0 if stored
   * before products had versions), one more with each change. A change is
   * saved only onto the version it was made from, so an owner editing an
   * outdated copy cannot overwrite a newer one.
   */
  readonly version: number;
};

/** What the owner enters for a product: everything but its slug, status, listing time and reserved stock. */
export type ProductContent = ProductTexts &
  Pick<Product, 'categorySlug' | 'featured' | 'photos'> & {
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
  /**
   * Adds to `unit` the write of `product`, changed from the stored version
   * `product.version`, as the next version; the unit's commit is a conflict
   * if the stored product is no longer at that version.
   */
  updateIn(unit: UnitOfWork, product: Product): void;
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
 * Why the owner's new content cannot replace a product's: a variant that
 * checkouts in progress hold stock of is removed, or a variant (by its
 * position in the content) would have less on-hand stock than they hold.
 */
export type RevisionProblem =
  | { readonly rule: 'variant_has_reserved_stock' }
  | { readonly rule: 'below_reserved_stock'; readonly position: number };

/**
 * The product with the owner's new `content` at `now`. Variants are matched by
 * SKU: one the owner keeps keeps its reserved stock, a new one has none. Stock
 * that checkouts in progress hold must stay on hand, so the revision is
 * refused if it removes a variant they hold stock of, or sets a variant's
 * on-hand stock below its reserved stock. The slug never changes: URLs depend on it.
 */
export function reviseProduct(product: Product, content: ProductContent, now: Date): Product | RevisionProblem[] {
  const reserved = new Map(product.variants.map((variant) => [variant.sku, variant.reservedStock]));
  const kept = new Set(content.variants.map((variant) => variant.sku));
  const variants = content.variants.map((variant) => ({ ...variant, reservedStock: reserved.get(variant.sku) ?? 0 }));
  const problems: RevisionProblem[] = [
    ...(product.variants.some((variant) => variant.reservedStock > 0 && !kept.has(variant.sku))
      ? [{ rule: 'variant_has_reserved_stock' } as const]
      : []),
    ...variants.flatMap((variant, position) =>
      variant.onHandStock < variant.reservedStock ? [{ rule: 'below_reserved_stock', position } as const] : [],
    ),
  ];
  if (problems.length > 0) return problems;
  return {
    ...product,
    ...productTexts(content),
    categorySlug: content.categorySlug,
    featured: content.featured,
    variants,
    photos: content.photos,
    updatedAt: now,
  };
}

/** What the owner can do to a product's status. There is no deleting: a product no longer sold is archived. */
export type StatusChange = 'list' | 'unlist' | 'archive' | 'restore';

/**
 * Each status change: the statuses it changes, and to what. A change that
 * `repeats` also succeeds on a product already in its status, leaving it as
 * it is: any product can be archived, an archived one too.
 */
const TRANSITIONS: Record<StatusChange, { from: readonly ProductStatus[]; to: ProductStatus; repeats?: true }> = {
  list: { from: ['draft'], to: 'listed' },
  unlist: { from: ['listed'], to: 'draft' },
  archive: { from: ['draft', 'listed'], to: 'archived', repeats: true },
  restore: { from: ['archived'], to: 'draft' },
};

/** Whether `change` succeeds on the product without changing it: archiving an archived product. */
export function leavesStatusAsIs(product: Product, change: StatusChange): boolean {
  const { to, repeats } = TRANSITIONS[change];
  return repeats === true && product.status === to;
}

/**
 * The status changes that change the product's status, in a fixed order
 * (list, unlist, archive, restore). Archiving an archived product is not
 * among them: it would leave the product as it is.
 */
export function allowedStatusChanges(product: Product): StatusChange[] {
  return (Object.keys(TRANSITIONS) as StatusChange[]).filter((change) =>
    TRANSITIONS[change].from.includes(product.status),
  );
}

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

/** The photo lists and the home page show for the product: its first, if it has any. */
export function mainPhoto(product: Product): ProductPhoto | undefined {
  return product.photos[0];
}

/** On-hand stock less reserved stock, never negative. */
export function availableStock(variant: Variant): number {
  return Math.max(0, variant.onHandStock - variant.reservedStock);
}

/** How many of a product's variant a checkout reserves or releases. */
export type StockQuantity = { readonly sku: string; readonly quantity: number };

/** A variant whose available stock is short of what a checkout wanted to reserve. */
export type StockShortfall = { readonly sku: string; readonly availableStock: number };

/**
 * The product with `quantities` of its variants reserved by a checkout, or
 * the variants that do not have that many available (all of them; none of
 * the stock is reserved then). A variant the product does not have counts
 * as having none available.
 */
export function reserveStock(product: Product, quantities: readonly StockQuantity[]): Product | StockShortfall[] {
  const wanted = totalsBySku(quantities);
  const shortfalls = [...wanted].flatMap(([sku, quantity]) => {
    const variant = product.variants.find((candidate) => candidate.sku === sku);
    const available = variant ? availableStock(variant) : 0;
    return available < quantity ? [{ sku, availableStock: available }] : [];
  });
  if (shortfalls.length > 0) return shortfalls;
  return {
    ...product,
    variants: product.variants.map((variant) => ({
      ...variant,
      reservedStock: variant.reservedStock + (wanted.get(variant.sku) ?? 0),
    })),
  };
}

/**
 * The product with stock a checkout had reserved released: available again.
 * Never below none reserved, and a variant the product no longer has is
 * skipped (one with reserved stock cannot be removed, so this does not happen).
 */
export function releaseStock(product: Product, quantities: readonly StockQuantity[]): Product {
  const released = totalsBySku(quantities);
  return {
    ...product,
    variants: product.variants.map((variant) => ({
      ...variant,
      reservedStock: Math.max(0, variant.reservedStock - (released.get(variant.sku) ?? 0)),
    })),
  };
}

function totalsBySku(quantities: readonly StockQuantity[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const { sku, quantity } of quantities) totals.set(sku, (totals.get(sku) ?? 0) + quantity);
  return totals;
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
