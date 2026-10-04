import { queryPartition, type Database } from '../../platform/dynamodb';
import type { LocalizedText } from '../../shared-kernel/localized-text';
import type { Category, CategoryRepository } from '../domain/category';

/**
 * A category's item. Provisional: nothing writes categories yet, and ticket #7
 * confirms or replaces this layout. Until then the API tests seed it directly
 * (test/support/catalog-seed.ts).
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
