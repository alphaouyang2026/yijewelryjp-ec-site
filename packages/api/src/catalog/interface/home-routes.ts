import { Hono } from 'hono';
import type { GetHomeData } from '../application/get-home-data';

export function homeRoutes(getHomeData: GetHomeData) {
  return new Hono().get('/', async (c) => c.json(await getHomeData('ja'), 200));
}
