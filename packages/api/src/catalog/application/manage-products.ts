import type { Clock } from '../../shared-kernel/clock';
import type { Locale } from '../../shared-kernel/locale';
import type { LocalizedText } from '../../shared-kernel/localized-text';
import { yen } from '../../shared-kernel/money';
import type { CategoryRepository } from '../domain/category';
import {
  byLatestChange,
  changeStatus,
  newProduct,
  positionsWithTakenSku,
  reviseProduct,
  type Product,
  type ProductContent,
  type ProductRepository,
  type ProductStatus,
  type RevisionProblem,
  type StatusChange,
} from '../domain/product';
import { adminProduct, adminProductSummary, type AdminProduct, type AdminProductSummary } from './admin-catalog-views';

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
  rule: 'slug_taken' | 'sku_taken' | 'unknown_category' | 'variant_has_reserved_stock' | 'below_reserved_stock';
};

/** How a change the owner asked for ended. */
export type ProductChange =
  | { outcome: 'changed'; product: AdminProduct }
  /** The input breaks catalog rules; nothing changed. */
  | { outcome: 'invalid'; violations: RuleViolation[] }
  | { outcome: 'not_found' }
  /** The change was made from a version of the product that is no longer the stored one; nothing changed. */
  | { outcome: 'stale' }
  /** The product's status does not allow the status change; nothing changed. */
  | { outcome: 'invalid_status_transition' };

export type { StatusChange };
export { PRODUCT_STATUSES } from '../domain/product';

export type ListAdminProducts = (query: {
  locale: Locale;
  /** Only products in this status; every product without it. */
  status?: ProductStatus;
}) => Promise<{ products: AdminProductSummary[] }>;

/** Use case: the admin's product list, in every status (or one), the most recently changed first. */
export function listAdminProducts(deps: Pick<Deps, 'products' | 'categories'>): ListAdminProducts {
  return async ({ locale, status }) => {
    const [products, categories] = await Promise.all([deps.products.all(), deps.categories.listInDisplayOrder()]);
    return {
      products: products
        .filter((product) => status === undefined || product.status === status)
        .sort(byLatestChange)
        .map((product) => adminProductSummary(product, locale, categories)),
    };
  };
}

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

export type EditProduct = (command: { slug: string; input: ProductInput; version: number }) => Promise<ProductChange>;

/**
 * Use case: the owner changes a product's content and variants, setting each
 * variant's on-hand stock directly, as of its version `version`. Its slug and
 * status stay as they are.
 */
export function editProduct(deps: Deps): EditProduct {
  return ({ slug, input, version }) =>
    changeFrom(deps, { slug, version }, async (product) => {
      const [products, categories] = await Promise.all([deps.products.all(), deps.categories.listInDisplayOrder()]);
      const violations = contentViolations(input, {
        otherProducts: products.filter((other) => other.slug !== slug),
        categorySlugs: categories.map((category) => category.slug),
      });
      const revised = reviseProduct(product, productContent(input), deps.clock.now());
      if (Array.isArray(revised)) violations.push(...revised.map(revisionViolation));
      if (violations.length > 0 || Array.isArray(revised)) return { outcome: 'invalid', violations };
      return revised;
    });
}

export type ChangeProductStatus = (command: { slug: string; change: StatusChange; version: number }) => Promise<ProductChange>;

/**
 * Use case: the owner lists, unlists, archives or restores a product, as of
 * its version `version` (the one the owner saw).
 */
export function changeProductStatus(deps: Deps): ChangeProductStatus {
  return ({ slug, change, version }) =>
    changeFrom(deps, { slug, version }, (product) => {
      const changed = changeStatus(product, change, deps.clock.now());
      return changed ?? { outcome: 'invalid_status_transition' };
    });
}

/**
 * Applies `change` to the product `slug` and saves it, if the owner made it
 * from the stored version (`version`): checked when the product is read, and
 * again when it is written, in case someone changed it in between.
 */
async function changeFrom(
  deps: Pick<Deps, 'products'>,
  { slug, version }: { slug: string; version: number },
  change: (product: Product) => Promise<Product | ProductChange> | Product | ProductChange,
): Promise<ProductChange> {
  const product = await deps.products.bySlug(slug);
  if (!product) return { outcome: 'not_found' };
  if (product.version !== version) return { outcome: 'stale' };

  const changed = await change(product);
  if ('outcome' in changed) return changed;
  const saved = await deps.products.update(changed);
  return saved === 'stale' ? { outcome: 'stale' } : { outcome: 'changed', product: adminProduct(saved) };
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

/** The field of the edit form a revision problem is about. */
function revisionViolation(problem: RevisionProblem): RuleViolation {
  return problem.rule === 'below_reserved_stock'
    ? { path: `variants.${problem.position}.onHandStock`, rule: problem.rule }
    : { path: 'variants', rule: problem.rule };
}

function productContent({ categorySlug, variants, ...input }: ProductInput): ProductContent {
  return {
    ...input,
    categorySlug: categorySlug ?? undefined,
    variants: variants.map(({ priceYen, ...variant }) => ({ ...variant, price: yen(priceYen) })),
  };
}
