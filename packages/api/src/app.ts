import { Hono } from 'hono';
import { getHomeData } from './catalog/application/get-home-data';
import { getProduct } from './catalog/application/get-product';
import { listProducts } from './catalog/application/list-products';
import type { CategoryRepository } from './catalog/domain/category';
import type { ProductRepository } from './catalog/domain/product';
import { homeRoutes } from './catalog/interface/home-routes';
import { productRoutes } from './catalog/interface/product-routes';
import { resumeSession } from './identity/application/resume-session';
import { beginSignIn, finishSignIn } from './identity/application/sign-in';
import { signOut } from './identity/application/sign-out';
import type { AdminIdentity } from './identity/domain/admin-identity';
import { adminSessionRoutes } from './identity/interface/admin-session-routes';
import { ownerOnly } from './identity/interface/owner-only';
import { signInRoutes } from './identity/interface/sign-in-routes';
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
  adminIdentity: AdminIdentity;
  /** Signs the owner's session cookie. Production reads it from Secrets Manager. */
  sessionSecret: string;
};

/** The API: each module's routes, wired to its use cases. */
export function createApp(deps: AppDeps) {
  // The admin's routes, every one behind the owner-only guard: 401 without a
  // signed-in owner's session, 403 for a data-changing request without the
  // session's CSRF token. Admin routes of every context go in this group, so
  // none can forget the rules.
  const admin = new Hono()
    .use(ownerOnly({ resumeSession: resumeSession(deps), sessionSecret: deps.sessionSecret }))
    .route('/', adminSessionRoutes(signOut(deps)));

  return new Hono()
    .basePath('/api')
    .use(noStoreUnlessAllowed)
    .route('/health', healthRoutes(checkHealth(deps)))
    .route('/home', homeRoutes(getHomeData(deps)))
    .route('/products', productRoutes(listProducts(deps), getProduct(deps)))
    // The owner's way in, open to everyone. Mounted before the admin group, so
    // these routes answer before its guard (which also matches /admin/auth/*).
    .route(
      '/admin/auth',
      signInRoutes({ beginSignIn: beginSignIn(deps), finishSignIn: finishSignIn(deps), sessionSecret: deps.sessionSecret }),
    )
    .route('/admin', admin);
}

export type AppType = ReturnType<typeof createApp>;
