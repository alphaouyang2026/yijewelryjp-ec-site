import { DescribeTableCommand, type DynamoDBClient } from '@aws-sdk/client-dynamodb';

/** The API's single table, keyed by `pk` (partition) and `sk` (sort), and the client that reaches it. */
export type Database = {
  client: DynamoDBClient;
  tableName: string;
};

/** Resolves if DynamoDB answers and the table exists; rejects otherwise. */
export async function checkTable({ client, tableName }: Database) {
  await client.send(new DescribeTableCommand({ TableName: tableName }));
}
