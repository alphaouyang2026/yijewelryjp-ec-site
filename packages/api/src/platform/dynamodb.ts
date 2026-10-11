import { DescribeTableCommand, type DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, paginateQuery } from '@aws-sdk/lib-dynamodb';

/** The API's single table, keyed by `pk` (partition) and `sk` (sort), and the client that reaches it. */
export type Database = {
  client: DynamoDBClient;
  tableName: string;
};

/** Resolves if DynamoDB answers and the table exists; rejects otherwise. */
export async function checkTable({ client, tableName }: Database) {
  await client.send(new DescribeTableCommand({ TableName: tableName }));
}

/**
 * The items in partition `pk`, in sort key order (descending if asked), and at
 * most `limit` of them if given. Follows DynamoDB's pagination, so a partition
 * larger than one response still comes back whole. `Item` is the caller's item
 * layout, which DynamoDB does not check.
 */
export async function queryPartition<Item>(
  { client, tableName }: Database,
  pk: string,
  { descending = false, limit }: { descending?: boolean; limit?: number } = {},
): Promise<Item[]> {
  const items: Item[] = [];
  const pages = paginateQuery(
    { client: DynamoDBDocumentClient.from(client), pageSize: limit },
    {
      TableName: tableName,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': pk },
      ScanIndexForward: !descending,
    },
  );
  for await (const page of pages) {
    items.push(...((page.Items ?? []) as Item[]));
    if (limit !== undefined && items.length >= limit) break;
  }
  return items.slice(0, limit);
}

/**
 * `item` without its undefined properties, at any depth, so optional
 * attributes are left out rather than refused: DynamoDB stores no undefined.
 * (The document client's removeUndefinedValues option is no way round this:
 * every document client on one DynamoDB client shares one set of options.)
 */
export function withoutUndefined<Item>(item: Item): Item {
  if (Array.isArray(item)) return item.map(withoutUndefined) as Item;
  if (item === null || typeof item !== 'object' || item instanceof Date) return item;
  return Object.fromEntries(
    Object.entries(item)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, withoutUndefined(value)]),
  ) as Item;
}
