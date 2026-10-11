import type { ProductStatus } from './api';

// `satisfies Record<ProductStatus, …>` fails type checking unless every status the API has is listed exactly once.
const STATUS_ORDER = { draft: 0, listed: 1, archived: 2 } satisfies Record<ProductStatus, number>;

/** A product's statuses, in the order the admin's status filter shows them. */
export const PRODUCT_STATUSES = (Object.keys(STATUS_ORDER) as ProductStatus[]).sort(
  (a, b) => STATUS_ORDER[a] - STATUS_ORDER[b],
);

/** The status a URL's `?status=` asks for; undefined (every status) for a missing or unknown one. */
export function productStatusOf(value: string | null): ProductStatus | undefined {
  return PRODUCT_STATUSES.find((status) => status === value);
}
