import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { LocalizedText } from '../../shared-kernel/localized-text';
import type { Database } from '../../platform/dynamodb';
import type { Product, ProductRepository } from '../domain/product';

/**
 * The item that puts a listed product in the new arrivals, sorted by when it
 * was listed. Provisional: nothing lists products yet, and the catalog's own
 * ticket settles the item layout together with its writers.
 */
type NewArrivalItem = {
  pk: 'NEW_ARRIVAL';
  sk: string; // `${listedAt ISO 8601}#${slug}`
  slug: string;
  name: LocalizedText;
};

export function dynamoDbProductRepository(db: Database): ProductRepository {
  const documents = DynamoDBDocumentClient.from(db.client);

  return {
    async listNewArrivals(limit) {
      const { Items = [] } = await documents.send(
        new QueryCommand({
          TableName: db.tableName,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: { ':pk': 'NEW_ARRIVAL' },
          ScanIndexForward: false,
          Limit: limit,
        }),
      );
      return (Items as NewArrivalItem[]).map(toProduct);
    },
  };
}

function toProduct(item: NewArrivalItem): Product {
  return { slug: item.slug, name: item.name };
}
