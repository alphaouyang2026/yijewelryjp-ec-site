import type { RouteObject } from 'react-router';
import { AdminErrorPage } from '../components/pages/admin/AdminErrorPage';
import { HomePage } from '../components/pages/home/HomePage';
import { homeLoader } from '../components/pages/home/homeLoader';
import { ProductDetailPage } from '../components/pages/product/ProductDetailPage';
import { productLoader } from '../components/pages/product/productLoader';
import { ProductListPage } from '../components/pages/products/ProductListPage';
import { productListLoader } from '../components/pages/products/productListLoader';
import { NotFoundPage } from '../components/pages/status/NotFoundPage';
import { LOCALES, localizedPath } from '../i18n/locales';
import { paths, type AdminSection, type AdminSectionHandle } from '../paths';
import { BlankHydrateFallback } from './BlankHydrateFallback';
import { LocaleRoot } from './LocaleRoot';
import { StoreRouteError } from './StoreRouteError';

/** A page whose loader fetches its data: blank until the data arrives, the store's error pages if it fails. */
const pageWithData = (route: RouteObject): RouteObject => ({
  HydrateFallback: BlankHydrateFallback,
  ErrorBoundary: StoreRouteError,
  ...route,
});

/** The admin's sections whose pages later tickets build: a placeholder until then. */
const ADMIN_SECTIONS_TO_COME: AdminSection[] = ['orders', 'settings'];

/**
 * The admin, under /admin in each locale. Its code loads only when an admin
 * page is opened (a separate chunk), so the storefront never downloads it.
 * Its error page is the exception: it must show even when loading that chunk
 * fails.
 */
function adminPages(): RouteObject {
  return {
    path: 'admin',
    HydrateFallback: BlankHydrateFallback,
    ErrorBoundary: AdminErrorPage,
    lazy: async () => {
      const [{ AdminFramePage }, { adminSessionLoader }] = await Promise.all([
        import('../components/pages/admin/AdminFramePage'),
        import('../components/pages/admin/adminSessionLoader'),
      ]);
      return { Component: AdminFramePage, loader: adminSessionLoader };
    },
    children: [
      { index: true, lazy: async () => ({ Component: (await import('../components/pages/admin/AdminHomePage')).AdminHomePage }) },
      {
        path: 'products',
        lazy: async () => {
          const [{ AdminProductListPage }, { adminProductListLoader }] = await Promise.all([
            import('../components/pages/admin/products/AdminProductListPage'),
            import('../components/pages/admin/products/adminProductListLoader'),
          ]);
          return { Component: AdminProductListPage, loader: adminProductListLoader };
        },
      },
      {
        path: 'products/new',
        lazy: async () => {
          const [{ AdminNewProductPage }, { adminNewProductLoader }] = await Promise.all([
            import('../components/pages/admin/products/AdminNewProductPage'),
            import('../components/pages/admin/products/adminProductLoaders'),
          ]);
          return { Component: AdminNewProductPage, loader: adminNewProductLoader };
        },
      },
      {
        path: 'products/:slug/edit',
        lazy: async () => {
          const [{ AdminEditProductPage }, { adminEditProductLoader }] = await Promise.all([
            import('../components/pages/admin/products/AdminEditProductPage'),
            import('../components/pages/admin/products/adminProductLoaders'),
          ]);
          return { Component: AdminEditProductPage, loader: adminEditProductLoader };
        },
      },
      {
        path: 'categories',
        lazy: async () => {
          const [{ AdminCategoriesPage }, { adminCategoriesLoader }] = await Promise.all([
            import('../components/pages/admin/categories/AdminCategoriesPage'),
            import('../components/pages/admin/categories/adminCategoriesLoader'),
          ]);
          return { Component: AdminCategoriesPage, loader: adminCategoriesLoader };
        },
      },
      ...ADMIN_SECTIONS_TO_COME.map(
        (section): RouteObject => ({
          path: section,
          handle: { adminSection: section } satisfies AdminSectionHandle,
          lazy: async () => ({
            Component: (await import('../components/pages/admin/AdminSectionPage')).AdminSectionPage,
          }),
        }),
      ),
    ],
  };
}

/**
 * The page saying that signing in to the admin failed. It is outside the
 * admin's frame, which needs a session: without one, the frame would send the
 * browser to sign in again at once.
 */
function signInFailedPage(): RouteObject {
  return {
    path: 'admin/sign-in-failed',
    HydrateFallback: BlankHydrateFallback,
    ErrorBoundary: AdminErrorPage,
    lazy: async () => ({ Component: (await import('../components/pages/admin/SignInFailedPage')).SignInFailedPage }),
  };
}

/** The storefront's pages, relative to a locale's root (the paths match paths.ts). */
function storePages(): RouteObject[] {
  return [
    adminPages(),
    signInFailedPage(),
    pageWithData({ index: true, loader: homeLoader, Component: HomePage }),
    pageWithData({ path: 'products', loader: productListLoader, Component: ProductListPage }),
    pageWithData({ path: 'categories/:slug', loader: productListLoader, Component: ProductListPage }),
    pageWithData({ path: 'products/:slug', loader: productLoader, Component: ProductDetailPage }),
    { path: '*', Component: NotFoundPage },
  ];
}

/** The same pages under each locale's root: '/' (Japanese), '/zh/' and '/en/'. */
export const routes: RouteObject[] = LOCALES.map((locale) => ({
  path: localizedPath(locale, paths.home),
  Component: LocaleRoot,
  children: storePages(),
}));
