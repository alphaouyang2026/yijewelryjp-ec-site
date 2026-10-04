import type { RouteObject } from 'react-router';
import { BlankHydrateFallback } from './layout/BlankHydrateFallback';
import { HomePage } from './pages/home/HomePage';
import { homeLoader } from './pages/home/homeLoader';

export const routes: RouteObject[] = [
  { path: '/', loader: homeLoader, Component: HomePage, HydrateFallback: BlankHydrateFallback },
];
