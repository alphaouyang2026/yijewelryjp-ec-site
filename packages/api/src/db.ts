import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceInUseException,
} from '@aws-sdk/client-dynamodb';

export type Database = {
  client: DynamoDBClient;
  tableName: string;
};

/**
 * Creates the single table, keyed by `pk` (partition) and `sk` (sort). Every
 * DynamoDB Local table (local dev, tests) is created here, and the deployed
 * table must have the same shape. Does nothing if the table already exists.
 */
export async function createTable({ client, tableName }: Database) {
  try {
    await client.send(
      new CreateTableCommand({
        TableName: tableName,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'sk', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' },
        ],
      }),
    );
  } catch (error) {
    if (!(error instanceof ResourceInUseException)) throw error;
  }
}

/** Resolves if DynamoDB answers and the table exists; rejects otherwise. */
export async function checkTable({ client, tableName }: Database) {
  await client.send(new DescribeTableCommand({ TableName: tableName }));
}

export async function deleteTable({ client, tableName }: Database) {
  await client.send(new DeleteTableCommand({ TableName: tableName }));
}

/** A client for DynamoDB Local at DYNAMODB_ENDPOINT (default http://localhost:8100), which accepts any credentials. */
export function localDynamoClient() {
  return new DynamoDBClient({
    endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8100',
    region: 'ap-northeast-1',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
}
