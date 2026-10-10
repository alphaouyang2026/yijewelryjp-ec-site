/** What customers are told about how many they can buy. */
export type StockStatus = 'in_stock' | 'low_stock' | 'sold_out';

/** At or below this many available, a customer sees "low stock". The one place to change it. */
export const LOW_STOCK_THRESHOLD = 2;

/** The stock status for `available` units (available stock: on hand less reserved). */
export function stockStatusOf(available: number): StockStatus {
  if (available <= 0) return 'sold_out';
  if (available <= LOW_STOCK_THRESHOLD) return 'low_stock';
  return 'in_stock';
}
