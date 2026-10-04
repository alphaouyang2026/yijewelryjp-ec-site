import type { RouteObject } from 'react-router';
import { BlankHydrateFallback } from './layout/BlankHydrateFallback';
import { HomePage } from './pages/home/HomePage';
import { homeLoader } from './pages/home/homeLoader';
import { paths } from './paths';

export const routes: RouteObject[] = [
  { path: paths.home, loader: homeLoader, Component: HomePage, HydrateFallback: BlankHydrateFallback },
];
