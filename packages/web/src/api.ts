import type { AppType, CsrfHeader } from '@yi/api';
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
/** A product photo as the store shows it: its URL, and its alt text in the page's locale. */
export type ProductPhoto = ProductDetail['photos'][number];

export type AdminSession = InferResponseType<typeof api.admin.session.$get, 200>;

export type AdminProductList = InferResponseType<typeof api.admin.products.$get, 200>;
export type AdminProductSummary = AdminProductList['products'][number];
export type ProductStatus = AdminProductSummary['status'];
export type AdminProduct = InferResponseType<(typeof api.admin.products)[':slug']['$get'], 200>;
export type NewProduct = InferRequestType<typeof api.admin.products.$post>['json'];
export type ProductEdit = InferRequestType<(typeof api.admin.products)[':slug']['$put']>['json'];
export type PhotoUpload = InferResponseType<(typeof api.admin)['photo-uploads']['$post'], 200>;
export type AdminCategoryList = InferResponseType<typeof api.admin.categories.$get, 200>;
export type AdminCategory = AdminCategoryList['categories'][number];

/** The answer (400) to an admin form with invalid fields: each field's error code, by its path in the request body. */
export type InvalidInput = InferResponseType<typeof api.admin.products.$post, 400>;
export type FieldErrorCode = InvalidInput['fields'][number]['code'];
/** The answer (409) to a change made from an outdated version of a product or category. */
export type StaleVersion = InferResponseType<(typeof api.admin.products)[':slug']['$put'], 409>;

/** The header the admin's data-changing requests carry the session's CSRF token in. */
export const CSRF_HEADER: CsrfHeader = 'X-CSRF-Token';
