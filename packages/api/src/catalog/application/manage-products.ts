import type { Clock } from '../../shared-kernel/clock';
import type { LocalizedText } from '../../shared-kernel/localized-text';
import { yen } from '../../shared-kernel/money';
import type { CategoryRepository } from '../domain/category';
import { newProduct, positionsWithTakenSku, type Product, type ProductContent, type ProductRepository } from '../domain/product';
import { adminProduct, type AdminProduct } from './admin-catalog-views';

type Deps = { products: ProductRepository; categories: CategoryRepository; clock: Clock };

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

/**
 * A field of the owner's input that breaks a catalog rule, named by its path
 * in the input ('slug', 'variants.1.sku', …).
 */
export type RuleViolation = {
  path: string;
  rule: 'slug_taken' | 'sku_taken' | 'unknown_category' | 'variant_has_reserved_stock';
};

/** How a change the owner asked for ended. */
export type ProductChange =
  | { outcome: 'changed'; product: AdminProduct }
  /** The input breaks catalog rules; nothing changed. */
  | { outcome: 'invalid'; violations: RuleViolation[] };

export type GetAdminProduct = (slug: string) => Promise<AdminProduct | undefined>;

/** Use case: one product, in any status, as the admin edits it. Undefined if there is none with `slug`. */
export function getAdminProduct(deps: Pick<Deps, 'products'>): GetAdminProduct {
  return async (slug) => {
    const product = await deps.products.bySlug(slug);
    return product && adminProduct(product);
  };
}

export type CreateProduct = (command: { slug: string; input: ProductInput }) => Promise<ProductChange>;

/** Use case: the owner creates a product. It starts as a draft, which customers do not see. */
export function createProduct(deps: Deps): CreateProduct {
  return async ({ slug, input }) => {
    const [products, categories] = await Promise.all([deps.products.all(), deps.categories.listInDisplayOrder()]);
    const violations = [
      ...(products.some((product) => product.slug === slug) ? [{ path: 'slug', rule: 'slug_taken' } as const] : []),
      ...contentViolations(input, { otherProducts: products, categorySlugs: categories.map((c) => c.slug) }),
    ];
    if (violations.length > 0) return { outcome: 'invalid', violations };

    const product = newProduct(slug, productContent(input), deps.clock.now());
    // Another owner may have taken the slug since the catalog was read.
    if ((await deps.products.add(product)) === 'slug_taken') {
      return { outcome: 'invalid', violations: [{ path: 'slug', rule: 'slug_taken' }] };
    }
    return { outcome: 'changed', product: adminProduct(product) };
  };
}

/** What in `input` breaks the catalog's rules, given every other product and the categories there are. */
function contentViolations(
  input: ProductInput,
  catalog: { otherProducts: readonly Product[]; categorySlugs: readonly string[] },
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  if (input.categorySlug !== null && !catalog.categorySlugs.includes(input.categorySlug)) {
    violations.push({ path: 'categorySlug', rule: 'unknown_category' });
  }
  for (const position of positionsWithTakenSku(input.variants, catalog.otherProducts)) {
    violations.push({ path: `variants.${position}.sku`, rule: 'sku_taken' });
  }
  return violations;
}

function productContent({ categorySlug, variants, ...input }: ProductInput): ProductContent {
  return {
    ...input,
    categorySlug: categorySlug ?? undefined,
    variants: variants.map(({ priceYen, ...variant }) => ({ ...variant, price: yen(priceYen) })),
  };
}
