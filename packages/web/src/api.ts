import type { AppType } from '@yi/api';
import { hc, type InferRequestType, type InferResponseType } from 'hono/client';

/** Typed client for the API, which is served under /api on the site's own origin. */
export const api = hc<AppType>(window.location.origin).api;

// Response types come from the API's routes; never redeclare them by hand.
export type HomeData = InferResponseType<typeof api.home.$get, 200>;
export type Category = HomeData['categories'][number];
export type ProductSummary = HomeData['newArrivals'][number];
export type FeaturedProduct = NonNullable<HomeData['featured']>;
export type StockStatus = ProductSummary['stockStatus'];

export type ProductList = InferResponseType<typeof api.products.$get, 200>;
export type ProductSort = NonNullable<InferRequestType<typeof api.products.$get>['query']['sort']>;

export type ProductPage = InferResponseType<(typeof api.products)[':slug']['$get'], 200>;
export type ProductDetail = ProductPage['product'];
export type Variant = ProductDetail['variants'][number];
