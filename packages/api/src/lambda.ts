// AWS Lambda entry point for requests from API Gateway HTTP API (payload format 2.0).
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { handle } from 'hono/aws-lambda';
import { createApp } from './app';
import { systemClock } from './clock';

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error('TABLE_NAME must be set');

const app = createApp({
  db: { client: new DynamoDBClient({}), tableName },
  clock: systemClock,
});

export const handler = handle(app);
