import { Hono } from 'hono';
import { findCartVariants } from './catalog/application/find-cart-variants';
import { getHomeData } from './catalog/application/get-home-data';
import { getProduct } from './catalog/application/get-product';
import { listProducts } from './catalog/application/list-products';
import {
  createCategory,
  listAdminCategories,
  renameCategory,
  reorderCategories,
} from './catalog/application/manage-categories';
import {
  changeProductStatus,
  createProduct,
  editProduct,
  getAdminProduct,
  listAdminProducts,
} from './catalog/application/manage-products';
import { startPhotoUpload } from './catalog/application/start-photo-upload';
import { releaseStock, reserveStock, sellReservedStock } from './catalog/application/stock-reservations';
import type { CategoryRepository } from './catalog/domain/category';
import type { PhotoStorage } from './catalog/domain/photo';
import type { ProductRepository } from './catalog/domain/product';
import { adminCategoryRoutes, categoryOrderRoutes } from './catalog/interface/admin-category-routes';
import { adminPhotoUploadRoutes } from './catalog/interface/admin-photo-routes';
import { adminProductRoutes } from './catalog/interface/admin-product-routes';
import { homeRoutes } from './catalog/interface/home-routes';
import { productRoutes } from './catalog/interface/product-routes';
import { resumeSession } from './identity/application/resume-session';
import { beginSignIn, finishSignIn } from './identity/application/sign-in';
import { signOut } from './identity/application/sign-out';
import type { AdminIdentity } from './identity/domain/admin-identity';
import { adminSessionRoutes } from './identity/interface/admin-session-routes';
import { ownerOnly } from './identity/interface/owner-only';
import { sessionCookie } from './identity/interface/session-cookie';
import { signInCookie } from './identity/interface/sign-in-cookie';
import { signInRoutes } from './identity/interface/sign-in-routes';
import { noStoreUnlessAllowed } from './interface/cache-control';
import type { SignedCookies } from './interface/signed-cookies';
import { checkHealth } from './operations/application/check-health';
import type { DatabaseProbe } from './operations/domain/database-probe';
import { healthRoutes } from './operations/interface/health-routes';
import { cancelCheckout, findCheckoutOrder, startCheckout } from './ordering/application/checkout';
import { addToCart, changeCartQuantity, removeFromCart, viewCart } from './ordering/application/manage-cart';
import { getOrderPage } from './ordering/application/order-page';
import { handlePaymentEvent } from './ordering/application/payment-events';
import type { Mailer } from './ordering/domain/mailer';
import type { OrderPageUrls } from './ordering/domain/order-page-urls';
import type { OrderRepository } from './ordering/domain/order';
import type { Payments } from './ordering/domain/payments';
import { cartCookie } from './ordering/interface/cart-cookie';
import { cartRoutes } from './ordering/interface/cart-routes';
import { checkoutRoutes } from './ordering/interface/checkout-routes';
import { orderRoutes } from './ordering/interface/order-routes';
import { paymentEventRoutes } from './ordering/interface/payment-event-routes';
import type { Clock } from './shared-kernel/clock';
import type { StartUnitOfWork } from './shared-kernel/unit-of-work';
import { getOwnerNotifications } from './store/application/get-owner-notifications';
import { getShippingRates } from './store/application/get-shipping-rates';
import type { StoreSettings } from './store/domain/store-settings';

/**
 * The adapters the API runs on. Each entry point (local, Lambda) chooses them,
 * and so does each test; `createApp` injects them into the application layer.
 */
export type AppDeps = {
  categories: CategoryRepository;
  products: ProductRepository;
  orders: OrderRepository;
  /** Units of work on the table, for writes that must be made together, such as an order and its reserved stock. */
  startUnitOfWork: StartUnitOfWork;
  /** Where product photos are uploaded to and served from. Production: S3. */
  photoStorage: PhotoStorage;
  databaseProbe: DatabaseProbe;
  clock: Clock;
  adminIdentity: AdminIdentity;
  /** Signs the API's cookies, each with its own key. Production derives the keys from a secret in Secrets Manager. */
  signedCookies: SignedCookies;
  /** The store settings, such as the shipping rates. Until the owner can edit them (#16), configured defaults. */
  storeSettings: StoreSettings;
  /** The payment service. Production: Stripe. */
  payments: Payments;
  /** The storefront's pages about an order: those the payment page sends customers back to, and the order page. */
  orderPageUrls: OrderPageUrls;
  /** Sends the store's emails. Production: SES. */
  mailer: Mailer;
};

/** The API: each module's routes, wired to its use cases. */
export function createApp(deps: AppDeps) {
  const cookies = {
    session: sessionCookie(deps.signedCookies),
    signIn: signInCookie(deps.signedCookies),
    cart: cartCookie(deps.signedCookies),
  };

  // The ordering context uses the catalog and the store settings through their application layers.
  const cartDeps = { findCartVariants: findCartVariants(deps), shippingRates: getShippingRates(deps) };
  const checkoutDeps = {
    ...deps,
    reserveStock: reserveStock(deps),
    releaseStock: releaseStock(deps),
    shippingRates: cartDeps.shippingRates,
  };

  // The admin's routes, every one behind the owner-only guard: 401 without a
  // signed-in owner's session, 403 for a data-changing request without the
  // session's CSRF token. Admin routes of every context go in this group, so
  // none can forget the rules.
  const admin = new Hono()
    .use(ownerOnly({ resumeSession: resumeSession(deps), sessionCookie: cookies.session }))
    .route('/', adminSessionRoutes({ signOut: signOut(deps), sessionCookie: cookies.session }))
    .route(
      '/products',
      adminProductRoutes({
        listAdminProducts: listAdminProducts(deps),
        createProduct: createProduct(deps),
        getAdminProduct: getAdminProduct(deps),
        editProduct: editProduct(deps),
        changeProductStatus: changeProductStatus(deps),
      }),
    )
    .route('/photo-uploads', adminPhotoUploadRoutes({ startPhotoUpload: startPhotoUpload(deps) }))
    .route(
      '/categories',
      adminCategoryRoutes({
        listAdminCategories: listAdminCategories(deps),
        createCategory: createCategory(deps),
        renameCategory: renameCategory(deps),
      }),
    )
    .route('/category-order', categoryOrderRoutes({ reorderCategories: reorderCategories(deps) }));

  return new Hono()
    .basePath('/api')
    .use(noStoreUnlessAllowed)
    .route('/health', healthRoutes(checkHealth(deps)))
    .route('/home', homeRoutes(getHomeData(deps)))
    .route('/products', productRoutes(listProducts(deps), getProduct(deps)))
    .route(
      '/cart',
      cartRoutes({
        viewCart: viewCart(cartDeps),
        addToCart: addToCart(cartDeps),
        changeCartQuantity: changeCartQuantity(cartDeps),
        removeFromCart: removeFromCart(cartDeps),
        cartCookie: cookies.cart,
      }),
    )
    .route(
      '/checkout',
      checkoutRoutes({
        startCheckout: startCheckout(checkoutDeps),
        findCheckoutOrder: findCheckoutOrder(deps),
        cancelCheckout: cancelCheckout(checkoutDeps),
        cartCookie: cookies.cart,
      }),
    )
    .route('/orders', orderRoutes({ getOrderPage: getOrderPage(deps) }))
    .route(
      '/payment-events',
      paymentEventRoutes({
        handlePaymentEvent: handlePaymentEvent({
          ...deps,
          sellReservedStock: sellReservedStock(deps),
          releaseStock: checkoutDeps.releaseStock,
          ownerNotifications: getOwnerNotifications(deps),
        }),
      }),
    )
    // The owner's way in, open to everyone. Mounted before the admin group, so
    // these routes answer before its guard (which also matches /admin/auth/*).
    .route(
      '/admin/auth',
      signInRoutes({
        beginSignIn: beginSignIn(deps),
        finishSignIn: finishSignIn(deps),
        signInCookie: cookies.signIn,
        sessionCookie: cookies.session,
      }),
    )
    .route('/admin', admin);
}

export type AppType = ReturnType<typeof createApp>;
