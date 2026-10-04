import { Hono } from 'hono';
import { getHomeData } from './catalog/application/get-home-data';
import type { CategoryRepository } from './catalog/domain/category';
import type { ProductRepository } from './catalog/domain/product';
import { homeRoutes } from './catalog/interface/home-routes';
import { checkHealth, type DatabaseProbe } from './operations/application/check-health';
import { healthRoutes } from './operations/interface/health-routes';
import type { Clock } from './shared-kernel/clock';

/**
 * The adapters the API runs on. Each entry point (local, Lambda) chooses them,
 * and so does each test; `createApp` injects them into the application layer.
 */
export type AppDeps = {
  categories: CategoryRepository;
  products: ProductRepository;
  database: DatabaseProbe;
  clock: Clock;
};

/** The API: each module's routes, wired to its use cases. */
export function createApp(deps: AppDeps) {
  return new Hono()
    .basePath('/api')
    .route('/health', healthRoutes(checkHealth(deps)))
    .route('/home', homeRoutes(getHomeData(deps)));
}

export type AppType = ReturnType<typeof createApp>;
