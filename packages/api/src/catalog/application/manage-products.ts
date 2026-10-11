import type { Clock } from '../../shared-kernel/clock';
import type { LocalizedText } from '../../shared-kernel/localized-text';
import { yen } from '../../shared-kernel/money';
import { newProduct, type ProductContent, type ProductRepository } from '../domain/product';
import { adminProduct, type AdminProduct } from './admin-catalog-views';

type Deps = { products: ProductRepository; clock: Clock };

/**
 * What the owner enters for a product, already checked for form (the
 * interface layer validates each field): texts per locale, money as yen.
 */
export type ProductInput = {
  name: LocalizedText;
  description: LocalizedText;
  materials?: LocalizedText;
  dimensions?: LocalizedText;
  weight?: LocalizedText;
  care?: LocalizedText;
  categorySlug: string | null;
  featured: boolean;
  variants: { sku: string; label: LocalizedText; priceYen: number; onHandStock: number }[];
};

export type GetAdminProduct = (slug: string) => Promise<AdminProduct | undefined>;

/** Use case: one product, in any status, as the admin edits it. Undefined if there is none with `slug`. */
export function getAdminProduct(deps: Pick<Deps, 'products'>): GetAdminProduct {
  return async (slug) => {
    const product = await deps.products.bySlug(slug);
    return product && adminProduct(product);
  };
}

export type CreateProduct = (command: { slug: string; input: ProductInput }) => Promise<AdminProduct>;

/** Use case: the owner creates a product. It starts as a draft, which customers do not see. */
export function createProduct(deps: Deps): CreateProduct {
  return async ({ slug, input }) => {
    const product = newProduct(slug, productContent(input), deps.clock.now());
    await deps.products.add(product);
    return adminProduct(product);
  };
}

function productContent({ categorySlug, variants, ...input }: ProductInput): ProductContent {
  return {
    ...input,
    categorySlug: categorySlug ?? undefined,
    variants: variants.map(({ priceYen, ...variant }) => ({ ...variant, price: yen(priceYen) })),
  };
}
