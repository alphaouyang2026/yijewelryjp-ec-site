import { queryPartition, type Database } from '../../platform/dynamodb';
import type { LocalizedText } from '../../shared-kernel/localized-text';
import type { Category, CategoryRepository } from '../domain/category';

/**
 * A category's item: every category in partition CATEGORY, keyed by its slug,
 * with its place in the owner's order (see docs/adr/0005-catalog-data-layout.md).
 */
export type CategoryItem = {
  pk: 'CATEGORY';
  sk: string; // the slug
  name: LocalizedText;
  position: number;
};

export function dynamoDbCategoryRepository(db: Database): CategoryRepository {
  return {
    async listInDisplayOrder() {
      const items = await queryPartition<CategoryItem>(db, 'CATEGORY');
      return items.sort((a, b) => a.position - b.position).map(toCategory);
    },
  };
}

function toCategory(item: CategoryItem): Category {
  return { slug: item.sk, name: item.name };
}
