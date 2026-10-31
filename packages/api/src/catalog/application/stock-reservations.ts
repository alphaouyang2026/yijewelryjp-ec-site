import type { LocalizedText } from '../../shared-kernel/localized-text';
import type { Money } from '../../shared-kernel/money';
import type { UnitOfWork } from '../../shared-kernel/unit-of-work';
import {
  isListed,
  releaseStock as releaseProductStock,
  reserveStock as reserveProductStock,
  sellStock as sellProductStock,
  type Product,
  type ProductRepository,
} from '../domain/product';

// For the ordering context: checkouts reserve stock of the variants they
// order, release it when they end without a payment, and sell it once paid. The writes go into
// the checkout's unit of work, alongside its order's, so they are made
// together or not at all.

/** How many of a variant (named by its product's slug and its SKU) a checkout reserves or releases. */
export type VariantQuantity = { productSlug: string; sku: string; quantity: number };

/** A variant as a checkout reserved it: what the order keeps of it, as the catalog has it now. */
export type ReservedVariant = { productName: LocalizedText; variantLabel: LocalizedText; price: Money };

/** A variant a checkout could not reserve: its product is not on sale, or it has fewer available than wanted. */
export type UnavailableVariant = {
  productSlug: string;
  sku: string;
  productName: LocalizedText;
  /** Undefined when the product no longer has the variant. */
  variantLabel: LocalizedText | undefined;
  /** None for a variant that cannot be bought at all. */
  availableStock: number;
};

export type Reservation =
  /** Each quantity's variant, in the same order; undefined where no product has the slug (it is skipped). */
  | { outcome: 'reserved'; variants: (ReservedVariant | undefined)[] }
  /** Nothing is reserved. */
  | { outcome: 'unavailable'; variants: UnavailableVariant[] };

/**
 * Command, for the ordering context: reserves `quantities` of variants of
 * listed products, adding the writes to `unit`. All are reserved or none: if
 * any product is not on sale or any variant has fewer available than wanted,
 * none is, and the unit gets no writes. A product that no longer exists is
 * skipped. Each write is conditional on the product being as read, so the
 * unit's commit is a conflict if anything changed it since.
 */
export type ReserveStock = (command: {
  unit: UnitOfWork;
  quantities: readonly VariantQuantity[];
}) => Promise<Reservation>;

export function reserveStock(deps: { products: ProductRepository }): ReserveStock {
  return async ({ unit, quantities }) => {
    const products = await productsOf(deps, quantities);
    const reserved: Product[] = [];
    const unavailable: UnavailableVariant[] = [];

    for (const product of products.values()) {
      if (!product) continue;
      const own = quantities.filter(({ productSlug }) => productSlug === product.slug);
      const result = isListed(product)
        ? reserveProductStock(product, own)
        : own.map(({ sku }) => ({ sku, availableStock: 0 }));
      if (Array.isArray(result)) {
        unavailable.push(
          ...result.map(({ sku, availableStock }) => ({
            productSlug: product.slug,
            sku,
            productName: product.name,
            variantLabel: product.variants.find((variant) => variant.sku === sku)?.label,
            availableStock,
          })),
        );
      } else {
        reserved.push(result);
      }
    }
    if (unavailable.length > 0) return { outcome: 'unavailable', variants: unavailable };

    for (const product of reserved) deps.products.updateIn(unit, product);
    return {
      outcome: 'reserved',
      variants: quantities.map(({ productSlug, sku }) => {
        const product = products.get(productSlug);
        const variant = product?.variants.find((candidate) => candidate.sku === sku);
        return product && variant
          ? { productName: product.name, variantLabel: variant.label, price: variant.price }
          : undefined;
      }),
    };
  };
}

/**
 * Command, for the ordering context: releases stock a checkout reserved,
 * adding the writes to `unit`, each conditional on its product being as read.
 */
export type ReleaseStock = (command: { unit: UnitOfWork; quantities: readonly VariantQuantity[] }) => Promise<void>;

export function releaseStock(deps: { products: ProductRepository }): ReleaseStock {
  return async ({ unit, quantities }) => {
    for (const product of (await productsOf(deps, quantities)).values()) {
      if (!product) continue;
      const own = quantities.filter(({ productSlug }) => productSlug === product.slug);
      deps.products.updateIn(unit, releaseProductStock(product, own));
    }
  };
}

/**
 * Command, for the ordering context: sells stock a checkout reserved, once
 * its order is paid (on-hand and reserved stock both go down), adding the
 * writes to `unit`, each conditional on its product being as read.
 */
export type SellReservedStock = (command: {
  unit: UnitOfWork;
  quantities: readonly VariantQuantity[];
}) => Promise<void>;

export function sellReservedStock(deps: { products: ProductRepository }): SellReservedStock {
  return async ({ unit, quantities }) => {
    for (const product of (await productsOf(deps, quantities)).values()) {
      if (!product) continue;
      const own = quantities.filter(({ productSlug }) => productSlug === product.slug);
      deps.products.updateIn(unit, sellProductStock(product, own));
    }
  };
}

/** The products of `quantities`, each read once, by slug; undefined for a slug no product has. */
async function productsOf(
  deps: { products: ProductRepository },
  quantities: readonly VariantQuantity[],
): Promise<Map<string, Product | undefined>> {
  const slugs = [...new Set(quantities.map(({ productSlug }) => productSlug))];
  return new Map(await Promise.all(slugs.map(async (slug) => [slug, await deps.products.bySlug(slug)] as const)));
}
