import type { AdminUnauthorized } from '@yi/api';
import type { InferResponseType } from 'hono/client';
import { http, HttpResponse } from 'msw/http';
import {
  api,
  type AdminCategory,
  type AdminCategoryList,
  type AdminProduct,
  type AdminProductList,
  type AdminSession,
  type HomeData,
  type InvalidInput,
  type ProductList,
  type ProductPage,
  type StaleVersion,
} from '../api';
import type { Locale } from '../i18n/locales';

// Mock bodies are typed by the API's own route types, so they cannot drift from the real responses.

export const emptyHomeData: HomeData = { featured: null, newArrivals: [], categories: [] };

const unsupportedLocaleBody = { error: 'unsupported_locale', supportedLocales: ['ja', 'zh', 'en'] };
const unsupportedLocale: InferResponseType<typeof api.home.$get, 400> = unsupportedLocaleBody;
const notFound: InferResponseType<(typeof api.products)[':slug']['$get'], 404> = { error: 'not_found' };

const productsUrl = api.products.$url().href;

const unauthorized: AdminUnauthorized = { error: 'unauthorized' };

type AdminSignedOut = InferResponseType<(typeof api.admin)['sign-out']['$post'], 200>;

const adminProductsUrl = api.admin.products.$url().href;
const adminCategoriesUrl = api.admin.categories.$url().href;

/**
 * How a mocked admin change answers: 200 (or 201 for creating) with the
 * stored product or category, 400 with field errors, or 409 when made from an
 * outdated version.
 */
export type AdminChangeReply<Changed extends Record<string, unknown>> =
  | { status: 200 | 201; body: Changed }
  | { status: 400; body: InvalidInput }
  | { status: 409; body: StaleVersion | { error: 'invalid_status_transition' } };

const reply = <Changed extends Record<string, unknown>>({ status, body }: AdminChangeReply<Changed>) => HttpResponse.json(body, { status });

/** A signed-in owner's session, as GET /api/admin/session returns it. */
export const ownerSession: AdminSession = { owner: { email: 'owner@yijewelry.test' }, csrfToken: 'csrf-token-1' };

/** MSW handlers for the API routes, at the URLs the RPC client calls. */
export const mockApi = {
  /** Answers home data requests with `data`, whatever their locale. */
  home: (data: HomeData) => http.get(api.home.$url().href, () => HttpResponse.json(data)),

  /** Answers home data requests with the data for the requested locale, as the API does; 400 for any other locale. */
  homeByLocale: (dataByLocale: Record<Locale, HomeData>) =>
    http.get(api.home.$url().href, ({ request }) => {
      const locale = new URL(request.url).searchParams.get('locale');
      const data = Object.hasOwn(dataByLocale, locale ?? '') ? dataByLocale[locale as Locale] : undefined;
      return data ? HttpResponse.json(data) : HttpResponse.json(unsupportedLocale, { status: 400 });
    }),

  /**
   * Answers product list requests with `list`, or 404 when it is null (an
   * unknown category). `requests` collects each request's URL, so a test can
   * check the query the page sent.
   */
  productList: (list: ProductList | null, requests: URL[] = []) =>
    http.get(productsUrl, ({ request }) => {
      requests.push(new URL(request.url));
      return list ? HttpResponse.json(list) : HttpResponse.json(notFound, { status: 404 });
    }),

  /** Answers admin session requests with `session`, or 401 when it is null (not signed in). */
  adminSession: (session: AdminSession | null) =>
    http.get(api.admin.session.$url().href, () =>
      session ? HttpResponse.json(session) : HttpResponse.json(unauthorized, { status: 401 }),
    ),

  /** Answers admin session requests with a server error, as when the API is unavailable. */
  adminSessionFails: () =>
    http.get(api.admin.session.$url().href, () => HttpResponse.json({ error: 'internal' }, { status: 500 })),

  /**
   * Answers sign-out requests with `signedOut`, or 401 when it is null (the
   * session had already ended). `requests` collects each request, so a test
   * can check its query and headers.
   */
  adminSignOut: (signedOut: AdminSignedOut | null, requests: Request[] = []) =>
    http.post(api.admin['sign-out'].$url().href, ({ request }) => {
      requests.push(request);
      return signedOut ? HttpResponse.json(signedOut) : HttpResponse.json(unauthorized, { status: 401 });
    }),

  /** The next sign-out request fails as if the network were down; later ones go on to other handlers. */
  adminSignOutUnreachable: () => http.post(api.admin['sign-out'].$url().href, () => HttpResponse.error(), { once: true }),

  /**
   * Answers the admin's product list requests with `list`. `requests`
   * collects each request's URL, so a test can check the query the page sent.
   */
  adminProducts: (list: AdminProductList, requests: URL[] = []) =>
    http.get(adminProductsUrl, ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(list);
    }),

  /** Answers the admin's requests for a product with `product` for its slug; 404 for any other. */
  adminProduct: (product: AdminProduct) =>
    http.get(`${adminProductsUrl}/:slug`, ({ params }) =>
      params.slug === product.slug ? HttpResponse.json(product) : HttpResponse.json(notFound, { status: 404 }),
    ),

  /** Answers the admin's category list requests with `list`. */
  adminCategories: (list: AdminCategoryList) => http.get(adminCategoriesUrl, () => HttpResponse.json(list)),

  /** Answers requests to create a product with `answer`; `requests` collects each request. */
  adminCreateProduct: (answer: AdminChangeReply<AdminProduct>, requests: Request[] = []) =>
    http.post(adminProductsUrl, ({ request }) => {
      requests.push(request);
      return reply(answer);
    }),

  /** Answers requests to edit a product with `answer`; `requests` collects each request. */
  adminEditProduct: (answer: AdminChangeReply<AdminProduct>, requests: Request[] = []) =>
    http.put(`${adminProductsUrl}/:slug`, ({ request }) => {
      requests.push(request);
      return reply(answer);
    }),

  /** Answers requests to list, unlist, archive or restore a product with `answer`; `requests` collects each request. */
  adminChangeProductStatus: (answer: AdminChangeReply<AdminProduct>, requests: Request[] = []) =>
    http.post(`${adminProductsUrl}/:slug/:change`, ({ request }) => {
      requests.push(request);
      return reply(answer);
    }),

  /** Answers requests to create a category with `answer`; `requests` collects each request. */
  adminCreateCategory: (answer: AdminChangeReply<Omit<AdminCategory, 'displayName'>>, requests: Request[] = []) =>
    http.post(adminCategoriesUrl, ({ request }) => {
      requests.push(request);
      return reply(answer);
    }),

  /** Answers requests to rename a category with `answer`; `requests` collects each request. */
  adminRenameCategory: (answer: AdminChangeReply<Omit<AdminCategory, 'displayName'>>, requests: Request[] = []) =>
    http.put(`${adminCategoriesUrl}/:slug`, ({ request }) => {
      requests.push(request);
      return reply(answer);
    }),

  /** Answers requests to reorder the categories with `answer`; `requests` collects each request. */
  adminReorderCategories: (answer: AdminChangeReply<AdminCategoryList>, requests: Request[] = []) =>
    http.put(api.admin['category-order'].$url().href, ({ request }) => {
      requests.push(request);
      return reply(answer);
    }),

  /** Answers product page requests with the page for the requested slug; 404 for any other product. */
  productPages: (pages: Record<string, ProductPage>) =>
    http.get(`${productsUrl}/:slug`, ({ params }) => {
      const page = pages[String(params.slug)];
      return page ? HttpResponse.json(page) : HttpResponse.json(notFound, { status: 404 });
    }),
};
