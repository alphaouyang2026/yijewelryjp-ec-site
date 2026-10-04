import { DynamoDBDocumentClient, paginateQuery } from '@aws-sdk/lib-dynamodb';
import type { LocalizedText } from '../../shared-kernel/localized-text';
import type { Database } from '../../platform/dynamodb';
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
  const documents = DynamoDBDocumentClient.from(db.client);

  return {
    async listInDisplayOrder() {
      const items: CategoryItem[] = [];
      const pages = paginateQuery(
        { client: documents },
        {
          TableName: db.tableName,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: { ':pk': 'CATEGORY' },
        },
      );
      for await (const page of pages) items.push(...((page.Items ?? []) as CategoryItem[]));

      return items.sort((a, b) => a.position - b.position).map(toCategory);
    },
  };
}

function toCategory(item: CategoryItem): Category {
  return { slug: item.sk, name: item.name };
}
