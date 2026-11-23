import type { OrderStatus } from './api';

// `satisfies Record<OrderStatus, …>` fails type checking unless every status the API has is listed exactly once.
const STATUS_ORDER = { paid: 0, shipped: 1, cancelled: 2, pending_payment: 3, expired: 4 } satisfies Record<
  OrderStatus,
  number
>;

/** An order's statuses, in the order the admin's status filter shows them: those the owner acts on first. */
export const ORDER_STATUSES = (Object.keys(STATUS_ORDER) as OrderStatus[]).sort(
  (a, b) => STATUS_ORDER[a] - STATUS_ORDER[b],
);

/** The status a URL's `?status=` asks for; undefined (the list's default) for a missing or unknown one. */
export function orderStatusOf(value: string | null): OrderStatus | undefined {
  return ORDER_STATUSES.find((status) => status === value);
}
