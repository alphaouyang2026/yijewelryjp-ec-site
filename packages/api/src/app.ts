import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { Hono } from 'hono';
import type { Clock } from './clock';
import type { Database } from './db';

export type Category = { slug: string; name: string };
export type ProductSummary = { slug: string; name: string };
export type HomeData = { newArrivals: ProductSummary[]; categories: Category[] };

export type AppDeps = {
  db: Database;
  clock: Clock;
};

export function createApp({ db, clock }: AppDeps) {
  return new Hono()
    .basePath('/api')
    .get('/health', async (c) => {
      try {
        await db.client.send(new DescribeTableCommand({ TableName: db.tableName }));
      } catch (error) {
        console.error('Health check could not reach the database table', error);
        return c.json({ status: 'unavailable' }, 503);
      }
      return c.json({ status: 'ok', time: clock.now().toISOString() }, 200);
    })
    .get('/home', (c) => {
      const home: HomeData = { newArrivals: [], categories: [] };
      return c.json(home, 200);
    });
}

export type AppType = ReturnType<typeof createApp>;
