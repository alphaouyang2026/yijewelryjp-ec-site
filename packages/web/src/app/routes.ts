import type { RouteObject } from 'react-router';
import { HomePage } from '../components/pages/home/HomePage';
import { homeLoader } from '../components/pages/home/homeLoader';
import { ProductDetailPage } from '../components/pages/product/ProductDetailPage';
import { productLoader } from '../components/pages/product/productLoader';
import { ProductListPage } from '../components/pages/products/ProductListPage';
import { productListLoader } from '../components/pages/products/productListLoader';
import { NotFoundPage } from '../components/pages/status/NotFoundPage';
import { LOCALES, localizedPath } from '../i18n/locales';
import { paths } from '../paths';
import { BlankHydrateFallback } from './BlankHydrateFallback';
import { LocaleRoot } from './LocaleRoot';
import { StoreRouteError } from './StoreRouteError';

/** A page whose loader fetches its data: blank until the data arrives, the store's error pages if it fails. */
const pageWithData = (route: RouteObject): RouteObject => ({
  HydrateFallback: BlankHydrateFallback,
  ErrorBoundary: StoreRouteError,
  ...route,
});

/** The storefront's pages, relative to a locale's root (the paths match paths.ts). */
function storePages(): RouteObject[] {
  return [
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
