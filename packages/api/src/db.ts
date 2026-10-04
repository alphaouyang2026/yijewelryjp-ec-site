import { DynamoDBClient, type CreateTableCommandInput } from '@aws-sdk/client-dynamodb';

export type Database = {
  client: DynamoDBClient;
  tableName: string;
};

/**
 * The single table's key schema. The deployed table and every DynamoDB Local
 * table (local dev, tests) are created from this shape.
 */
export function tableDefinition(tableName: string): CreateTableCommandInput {
  return {
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
  };
}

export const DEFAULT_LOCAL_ENDPOINT = 'http://localhost:8100';

/** A client for DynamoDB Local, which accepts any credentials. */
export function localDynamoClient(endpoint = process.env.DYNAMODB_ENDPOINT ?? DEFAULT_LOCAL_ENDPOINT) {
  return new DynamoDBClient({
    endpoint,
    region: 'ap-northeast-1',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
}
