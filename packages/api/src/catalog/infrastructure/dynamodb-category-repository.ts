import { ConditionalCheckFailedException, TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { queryPartition, withoutUndefined, type Database } from '../../platform/dynamodb';
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
  /** Categories are listed by it, lowest first. */
  position: number;
  /** 1 when created, one more with each write; every write is conditional on the version it read. */
  version: number;
};

const PARTITION = 'CATEGORY';

/** Whether a write failed because an item was no longer at the version the write was conditional on. */
const isStale = (error: unknown) =>
  error instanceof ConditionalCheckFailedException ||
  (error instanceof TransactionCanceledException &&
    (error.CancellationReasons ?? []).some((reason) => reason.Code === 'ConditionalCheckFailed'));

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
      try {
        await documents.send(
          new UpdateCommand({
            TableName: db.tableName,
            Key: { pk: PARTITION, sk: category.slug },
            UpdateExpression: 'SET #name = :name, version = :next',
            ConditionExpression: 'version = :read',
            ExpressionAttributeNames: { '#name': 'name' },
            ExpressionAttributeValues: {
              ':name': withoutUndefined(category.name),
              ':read': category.version,
              ':next': category.version + 1,
            },
          }),
        );
        return { ...category, version: category.version + 1 };
      } catch (error) {
        if (isStale(error)) return 'stale';
        throw error;
      }
    },

    // One transaction (at most 100 items, far more categories than a shop
    // has), so the order is never half changed.
    async reorder(order) {
      try {
        await documents.send(
          new TransactWriteCommand({
            TransactItems: order.map(({ slug, version }, index) => ({
              Update: {
                TableName: db.tableName,
                Key: { pk: PARTITION, sk: slug },
                UpdateExpression: 'SET #position = :position, version = :next',
                ConditionExpression: 'version = :read',
                ExpressionAttributeNames: { '#position': 'position' },
                ExpressionAttributeValues: { ':position': index + 1, ':read': version, ':next': version + 1 },
              },
            })),
          }),
        );
        return 'reordered';
      } catch (error) {
        if (isStale(error)) return 'stale';
        throw error;
      }
    },
  };
}

function toCategory(item: CategoryItem): Category {
  return { slug: item.sk, name: item.name, version: item.version };
}
