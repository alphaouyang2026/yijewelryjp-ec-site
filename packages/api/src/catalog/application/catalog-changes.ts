// What the admin's catalog use cases (products, categories, their order)
// share: how an owner's change ended, and the catalog rules input can break.

/** A catalog rule the owner's input can break, beyond the form of each field. */
export type CatalogRule =
  /** Another product or category already has the slug. */
  | 'slug_taken'
  /** Another variant, of this product or any other, already has the SKU. */
  | 'sku_taken'
  | 'unknown_category'
  /** A variant that checkouts in progress hold stock of cannot be removed. */
  | 'variant_has_reserved_stock'
  /** On-hand stock cannot be below what checkouts in progress hold. */
  | 'below_reserved_stock';

/**
 * A field of the owner's input that breaks a catalog rule, named by its path
 * in the input ('slug', 'variants.1.sku', …).
 */
export type RuleViolation = { path: string; rule: CatalogRule };

/** Why an owner's change to the catalog changed nothing, by outcome. */
type Refusals = {
  /** The input breaks catalog rules. */
  invalid: { violations: RuleViolation[] };
  not_found: object;
  /** The change was made from a version that is no longer the stored one. */
  stale: object;
  /** The product's status does not allow the status change. */
  invalid_status_transition: object;
};

export type Refusal = keyof Refusals;

/**
 * How an owner's change to the catalog ended: `changed`, with what is now
 * stored, or one of the `Possible` refusals, when nothing changed.
 */
export type CatalogChange<Changed, Possible extends Refusal = Refusal> =
  | { outcome: 'changed'; changed: Changed }
  | { [R in Possible]: { outcome: R } & Refusals[R] }[Possible];
