import type { RouteObject } from 'react-router';
import { HomePage } from '../components/pages/home/HomePage';
import { homeLoader } from '../components/pages/home/homeLoader';
import { LOCALES, localizedPath } from '../i18n/locales';
import { paths } from '../paths';
import { BlankHydrateFallback } from './BlankHydrateFallback';
import { LocaleRoot } from './LocaleRoot';

/** The storefront's pages, relative to a locale's root. */
function storePages(): RouteObject[] {
  return [{ index: true, loader: homeLoader, Component: HomePage, HydrateFallback: BlankHydrateFallback }];
}

/** The same pages under each locale's root: '/' (Japanese), '/zh/' and '/en/'. */
export const routes: RouteObject[] = LOCALES.map((locale) => ({
  path: localizedPath(locale, paths.home),
  Component: LocaleRoot,
  children: storePages(),
}));
