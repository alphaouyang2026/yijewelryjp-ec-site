import { ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { localDynamoClient } from '../../src/db';

const TIMEOUT_MS = 20_000;

/** Vitest global setup: waits until DynamoDB Local answers, so a container still booting is not a test failure. */
export default async function waitForDynamoDbLocal() {
  const client = localDynamoClient();
  const deadline = Date.now() + TIMEOUT_MS;
  try {
    for (;;) {
      try {
        await client.send(new ListTablesCommand({ Limit: 1 }));
        return;
      } catch (error) {
        if (Date.now() > deadline) {
          const endpoint = await client.config.endpoint?.();
          throw new Error(
            `DynamoDB Local is not reachable at ${endpoint?.hostname}:${endpoint?.port}. Start it with \`npm run db:start\`.`,
            { cause: error },
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  } finally {
    client.destroy();
  }
}
