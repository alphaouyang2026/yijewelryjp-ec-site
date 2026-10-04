import { waitForDynamoDbLocal } from '../../src/platform/dynamodb-local';

/** Vitest global setup: a DynamoDB Local container that is still booting is not a test failure. */
export default async function waitForDatabase() {
  await waitForDynamoDbLocal();
}
