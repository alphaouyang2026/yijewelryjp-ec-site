/**
 * Writes to several aggregates, of one context or several, made all together
 * or not at all. Repositories add their writes to a unit; whoever started it
 * commits it. Checkout uses one to create an order and reserve its stock at
 * once (docs/adr/0002-backend-ddd-layers.md).
 */
export interface UnitOfWork {
  /**
   * Makes every write added, or none: 'conflict' when an aggregate a write
   * was conditional on changed since it was read (or another unit was writing
   * it at the same moment). Then the caller may read again and retry.
   */
  commit(): Promise<'committed' | 'conflict'>;
}

/** Starts an empty unit of work. Entry points inject the one on the API's table. */
export type StartUnitOfWork = () => UnitOfWork;
