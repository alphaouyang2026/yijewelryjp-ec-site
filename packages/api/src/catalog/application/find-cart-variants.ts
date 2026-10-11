import type { Locale } from '../../shared-kernel/locale';
import { textIn } from '../../shared-kernel/localized-text';
import type { Money } from '../../shared-kernel/money';
import { availableStock, isListed, mainPhoto, type ProductRepository } from '../domain/product';
import { photoView, type PhotoView } from './catalog-views';

/**
 * A variant in a customer's cart as the catalog has it now, with what the
 * cart shows of its product: texts in the requested locale, the main photo.
 */
export type CartVariant = {
  productSlug: string;
  productName: string;
  photo: PhotoView | null;
  /** Whether the product is on sale; drafts and archived products are not. */
  listed: boolean;
  /** Undefined when the product no longer has a variant with the SKU. */
  variant: { sku: string; label: string; price: Money; availableStock: number } | undefined;
};

/**
 * Query, for the ordering context: each of `items` (a product's slug and a
 * SKU) as the catalog has it now, in the same order; undefined where no
 * product has the slug.
 */
export type FindCartVariants = (query: {
  locale: Locale;
  items: readonly { productSlug: string; sku: string }[];
}) => Promise<(CartVariant | undefined)[]>;

/** Reads only the products the items name, each once: a cart holds few lines, the catalog many products. */
export function findCartVariants(deps: { products: ProductRepository }): FindCartVariants {
  return async ({ locale, items }) => {
    const slugs = [...new Set(items.map((item) => item.productSlug))];
    const products = new Map(
      await Promise.all(slugs.map(async (slug) => [slug, await deps.products.bySlug(slug)] as const)),
    );

    return items.map(({ productSlug, sku }) => {
      const product = products.get(productSlug);
      if (!product) return undefined;
      const variant = product.variants.find((candidate) => candidate.sku === sku);
      const photo = mainPhoto(product);
      return {
        productSlug,
        productName: textIn(product.name, locale),
        photo: photo ? photoView(photo, locale) : null,
        listed: isListed(product),
        variant: variant && {
          sku: variant.sku,
          label: textIn(variant.label, locale),
          price: variant.price,
          availableStock: availableStock(variant),
        },
      };
    });
  };
}
