import type { RouteObject } from 'react-router';
import { HomePage } from '../components/pages/home/HomePage';
import { homeLoader } from '../components/pages/home/homeLoader';
import { ProductDetailPage } from '../components/pages/product/ProductDetailPage';
import { productLoader } from '../components/pages/product/productLoader';
import { ProductListPage } from '../components/pages/products/ProductListPage';
import { productListLoader } from '../components/pages/products/productListLoader';
import { NotFoundPage } from '../components/pages/status/NotFoundPage';
import { LOCALES, localizedPath } from '../i18n/locales';
import { ADMIN_SECTIONS, paths } from '../paths';
import { BlankHydrateFallback } from './BlankHydrateFallback';
import { LocaleRoot } from './LocaleRoot';
import { StoreRouteError } from './StoreRouteError';

/** A page whose loader fetches its data: blank until the data arrives, the store's error pages if it fails. */
const pageWithData = (route: RouteObject): RouteObject => ({
  HydrateFallback: BlankHydrateFallback,
  ErrorBoundary: StoreRouteError,
  ...route,
});

/**
 * The admin, under /admin in each locale. Its code loads only when an admin
 * page is opened (a separate chunk), so the storefront never downloads it.
 */
function adminPages(): RouteObject {
  return {
    path: 'admin',
    HydrateFallback: BlankHydrateFallback,
    ErrorBoundary: StoreRouteError,
    lazy: async () => {
      const [{ AdminFramePage }, { adminSessionLoader }] = await Promise.all([
        import('../components/pages/admin/AdminFramePage'),
        import('../components/pages/admin/adminSessionLoader'),
      ]);
      return { Component: AdminFramePage, loader: adminSessionLoader };
    },
    children: [
      { index: true, lazy: async () => ({ Component: (await import('../components/pages/admin/AdminHomePage')).AdminHomePage }) },
      ...ADMIN_SECTIONS.map(
        (section): RouteObject => ({
          path: section,
          handle: { adminSection: section },
          lazy: async () => ({
            Component: (await import('../components/pages/admin/AdminSectionPage')).AdminSectionPage,
          }),
        }),
      ),
    ],
  };
}

/** The storefront's pages, relative to a locale's root (the paths match paths.ts). */
function storePages(): RouteObject[] {
  return [
    adminPages(),
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
