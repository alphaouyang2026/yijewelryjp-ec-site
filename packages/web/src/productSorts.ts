import type { ProductSort } from './api';

// `satisfies Record<ProductSort, …>` fails type checking unless every sort order the API supports is listed exactly once.
const SORT_ORDER = { newest: 0, price_asc: 1, price_desc: 2 } satisfies Record<ProductSort, number>;

/** The product list's sort orders, in the order the sort options show them. */
export const PRODUCT_SORTS = (Object.keys(SORT_ORDER) as ProductSort[]).sort((a, b) => SORT_ORDER[a] - SORT_ORDER[b]);

export const DEFAULT_PRODUCT_SORT: ProductSort = 'newest';

/** The sort order a URL's `?sort=` asks for; the default for a missing or unknown one. */
export function productSortOf(value: string | null): ProductSort {
  return PRODUCT_SORTS.find((sort) => sort === value) ?? DEFAULT_PRODUCT_SORT;
}
