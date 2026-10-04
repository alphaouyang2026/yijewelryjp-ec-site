import type { LocalizedText } from '../../shared-kernel/localized-text';

/** A group of products, such as rings or necklaces, that the site's navigation lists. */
export type Category = {
  readonly slug: string;
  readonly name: LocalizedText;
};

export interface CategoryRepository {
  /** Every category, in the order the shop owner arranged them. */
  listInDisplayOrder(): Promise<Category[]>;
}
