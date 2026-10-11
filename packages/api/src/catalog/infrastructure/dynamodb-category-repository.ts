import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { queryPartition, withoutUndefined, type Database } from '../../platform/dynamodb';
import type { LocalizedText } from '../../shared-kernel/localized-text';
import type { Category, CategoryRepository } from '../domain/category';
import { isStaleWrite, onVersion, storedVersion } from './versioned-writes';

/**
 * A category's item: every category in partition CATEGORY, keyed by its slug,
 * with its place in the owner's order (see docs/adr/0005-catalog-data-layout.md).
 */
export type CategoryItem = {
  pk: 'CATEGORY';
  sk: string; // the slug
  name: LocalizedText;
  /** Categories are listed by it, lowest first. */
  position: number;
  /**
   * 1 when created, one more with each write; every write is conditional on
   * the version it read. Absent from items written before items had versions.
   */
  version?: number;
};

const PARTITION = 'CATEGORY';

export function dynamoDbCategoryRepository(db: Database): CategoryRepository {
  const documents = DynamoDBDocumentClient.from(db.client);
  const items = async () =>
    (await queryPartition<CategoryItem>(db, PARTITION)).sort(
      (a, b) => a.position - b.position || a.sk.localeCompare(b.sk),
    );

  return {
    async listInDisplayOrder() {
      return (await items()).map(toCategory);
    },

    async add(category) {
      const last = (await items()).at(-1);
      const item: CategoryItem = {
        pk: PARTITION,
        sk: category.slug,
        name: category.name,
        position: (last?.position ?? 0) + 1,
        version: category.version,
      };
      try {
        await documents.send(
          new PutCommand({
            TableName: db.tableName,
            Item: withoutUndefined(item),
            ConditionExpression: 'attribute_not_exists(pk)',
          }),
        );
        return 'added';
      } catch (error) {
        if (error instanceof ConditionalCheckFailedException) return 'slug_taken';
        throw error;
      }
    },

    async update(category) {
      const written = onVersion(category.version);
      try {
        await documents.send(
          new UpdateCommand({
            TableName: db.tableName,
            Key: { pk: PARTITION, sk: category.slug },
            UpdateExpression: 'SET #name = :name, version = :next',
            ConditionExpression: written.ConditionExpression,
            ExpressionAttributeNames: { '#name': 'name' },
            ExpressionAttributeValues: {
              ...written.ExpressionAttributeValues,
              ':name': withoutUndefined(category.name),
              ':next': category.version + 1,
            },
          }),
        );
        return { ...category, version: category.version + 1 };
      } catch (error) {
        if (isStaleWrite(error)) return 'stale';
        throw error;
      }
    },

    // One transaction (at most 100 items, far more categories than a shop
    // has), so the order is never half changed.
    async reorder(order) {
      try {
        await documents.send(
          new TransactWriteCommand({
            TransactItems: order.map(({ slug, version }, index) => {
              const written = onVersion(version);
              return {
                Update: {
                  TableName: db.tableName,
                  Key: { pk: PARTITION, sk: slug },
                  UpdateExpression: 'SET #position = :position, version = :next',
                  ConditionExpression: written.ConditionExpression,
                  ExpressionAttributeNames: { '#position': 'position' },
                  ExpressionAttributeValues: {
                    ...written.ExpressionAttributeValues,
                    ':position': index + 1,
                    ':next': version + 1,
                  },
                },
              };
            }),
          }),
        );
        return 'reordered';
      } catch (error) {
        if (isStaleWrite(error)) return 'stale';
        throw error;
      }
    },
  };
}

function toCategory(item: CategoryItem): Category {
  return { slug: item.sk, name: item.name, version: storedVersion(item) };
}
