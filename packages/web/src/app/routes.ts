import type { RouteObject } from 'react-router';
import { HomePage } from '../components/pages/home/HomePage';
import { homeLoader } from '../components/pages/home/homeLoader';
import { paths } from '../paths';
import { BlankHydrateFallback } from './BlankHydrateFallback';

export const routes: RouteObject[] = [
  { path: paths.home, loader: homeLoader, Component: HomePage, HydrateFallback: BlankHydrateFallback },
];
