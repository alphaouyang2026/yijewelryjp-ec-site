import type { LocalizedText } from '../../shared-kernel/localized-text';

/** A design shown on the site. Only what the home page needs so far; variants, status and photos come with the catalog. */
export type Product = {
  readonly slug: string;
  readonly name: LocalizedText;
};

export interface ProductRepository {
  /** The most recently listed products, newest first, at most `limit` of them. */
  listNewArrivals(limit: number): Promise<Product[]>;
}
