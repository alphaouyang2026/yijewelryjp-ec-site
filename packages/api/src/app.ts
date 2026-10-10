import { Hono } from 'hono';
import { getHomeData } from './catalog/application/get-home-data';
import { getProduct } from './catalog/application/get-product';
import { listProducts } from './catalog/application/list-products';
import type { CategoryRepository } from './catalog/domain/category';
import type { ProductRepository } from './catalog/domain/product';
import { homeRoutes } from './catalog/interface/home-routes';
import { productRoutes } from './catalog/interface/product-routes';
import { noStoreUnlessAllowed } from './interface/cache-control';
import { checkHealth } from './operations/application/check-health';
import type { DatabaseProbe } from './operations/domain/database-probe';
import { healthRoutes } from './operations/interface/health-routes';
import type { Clock } from './shared-kernel/clock';

/**
 * The adapters the API runs on. Each entry point (local, Lambda) chooses them,
 * and so does each test; `createApp` injects them into the application layer.
 */
export type AppDeps = {
  categories: CategoryRepository;
  products: ProductRepository;
  databaseProbe: DatabaseProbe;
  clock: Clock;
};

/** The API: each module's routes, wired to its use cases. */
export function createApp(deps: AppDeps) {
  return new Hono()
    .basePath('/api')
    .use(noStoreUnlessAllowed)
    .route('/health', healthRoutes(checkHealth(deps)))
    .route('/home', homeRoutes(getHomeData(deps)))
    .route('/products', productRoutes(listProducts(deps), getProduct(deps)));
}

export type AppType = ReturnType<typeof createApp>;
