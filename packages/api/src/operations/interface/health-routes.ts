import { Hono } from 'hono';
import type { CheckHealth } from '../application/check-health';

export function healthRoutes(checkHealth: CheckHealth) {
  return new Hono().get('/', async (c) => {
    const health = await checkHealth();
    return health.status === 'ok' ? c.json(health, 200) : c.json(health, 503);
  });
}
