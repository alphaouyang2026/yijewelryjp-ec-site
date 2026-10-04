import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { CategoryItem } from '../../src/catalog/infrastructure/dynamodb-category-repository';
import type { NewArrivalItem } from '../../src/catalog/infrastructure/dynamodb-product-repository';
import type { Database } from '../../src/platform/dynamodb';
import type { LocalizedText } from '../../src/shared-kernel/localized-text';

/**
 * Puts catalog data straight into a test's table, for tests that need a
 * catalog before the API can build one. Tests still check results only
 * through the API. Provisional, like the item layout it writes: ticket #7
 * confirms or replaces that layout.
 */
export function catalogSeed(db: Database) {
  const documents = DynamoDBDocumentClient.from(db.client);
  const put = (items: (CategoryItem | NewArrivalItem)[]) =>
    Promise.all(items.map((item) => documents.send(new PutCommand({ TableName: db.tableName, Item: item }))));

  return {
    /** Categories, each at its `position` in the owner's order. */
    categories(categories: { slug: string; name: LocalizedText; position: number }[]) {
      return put(
        categories.map(({ slug, name, position }): CategoryItem => ({ pk: 'CATEGORY', sk: slug, name, position })),
      );
    },

    /** Products that were listed at `listedAt`, so they are new arrivals. */
    newArrivals(products: { slug: string; name: LocalizedText; listedAt: Date }[]) {
      return put(
        products.map(
          ({ slug, name, listedAt }): NewArrivalItem => ({
            pk: 'NEW_ARRIVAL',
            sk: `${listedAt.toISOString()}#${slug}`,
            slug,
            name,
          }),
        ),
      );
    },
  };
}
