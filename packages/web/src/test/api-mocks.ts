import { File as NodeFile } from 'node:buffer';
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
  type Cart,
  type CartAddRefusal,
  type CartQuantityRefusal,
  type HomeData,
  type InvalidInput,
  type PhotoUpload,
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

/**
 * An empty cart, as GET /api/cart answers without a cart cookie: no lines,
 * nothing to pay, ¥20,000 to go to free shipping (the API tests' rates).
 */
export const emptyCart: Cart = {
  lines: [],
  quantity: 0,
  subtotalYen: 0,
  shippingYen: 0,
  totalYen: 0,
  freeShippingThresholdYen: 20_000,
  freeShippingRemainingYen: 20_000,
};

type CartAddNotFound = InferResponseType<typeof api.cart.lines.$post, 404>;
type CartLineNotInCart = InferResponseType<(typeof api.cart.lines)[':lineId']['$put'], 404>;

/**
 * How a mocked cart change answers: 200 with the whole cart after the change,
 * or the refusal the API answers with (409, or 404 for a product or line it
 * does not know).
 */
export type CartChangeReply<Refusal, NotFound = never> =
  | { status: 200; body: Cart }
  | { status: 409; body: Refusal }
  | { status: 404; body: NotFound };

const cartLinesUrl = api.cart.lines.$url().href;

/** Where mocked upload forms post photos: photo storage (S3 in production). */
export const PHOTO_STORAGE_URL = 'https://yijewelry-photos.s3.ap-northeast-1.amazonaws.com/';

/** An upload form for a photo with `key`, as POST /api/admin/photo-uploads returns it. */
export function photoUploadForm(key: string, contentType = 'image/jpeg'): PhotoUpload {
  return {
    key,
    url: `/${key}`,
    upload: { url: PHOTO_STORAGE_URL, fields: { key, 'Content-Type': contentType, Policy: 'cG9saWN5', 'X-Amz-Signature': 'abc' } },
  };
}

/**
 * The form a request posted. Node's parser makes its files with the global
 * File, which it needs to be Node's, not jsdom's (see test/setup.ts); so
 * Node's stands in while it parses.
 */
async function formDataOf(request: Request): Promise<FormData> {
  const jsdomFile = globalThis.File;
  globalThis.File = NodeFile as unknown as typeof File;
  try {
    return await request.formData();
  } finally {
    globalThis.File = jsdomFile;
  }
}

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

  /**
   * Answers the admin's requests for a product with `product` (or what it
   * returns at the time, for a product that changes) for its slug; 404 for any other.
   */
  adminProduct: (product: AdminProduct | (() => AdminProduct)) =>
    http.get(`${adminProductsUrl}/:slug`, ({ params }) => {
      const current = typeof product === 'function' ? product() : product;
      return params.slug === current.slug ? HttpResponse.json(current) : HttpResponse.json(notFound, { status: 404 });
    }),

  /** Answers the admin's category list requests with `list` (or what it returns at the time, for a list that changes). */
  adminCategories: (list: AdminCategoryList | (() => AdminCategoryList)) =>
    http.get(adminCategoriesUrl, () => HttpResponse.json(typeof list === 'function' ? list() : list)),

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

  /**
   * Answers requests for photo upload forms with `answers` in turn (the last
   * one again once they run out): an upload form, or 400 with field errors.
   * `requests` collects each request.
   */
  adminPhotoUploads: (answers: (PhotoUpload | InvalidInput)[], requests: Request[] = []) =>
    http.post(api.admin['photo-uploads'].$url().href, ({ request }) => {
      requests.push(request);
      const answer = answers[Math.min(requests.length, answers.length) - 1];
      return answer && 'error' in answer ? HttpResponse.json(answer, { status: 400 }) : HttpResponse.json(answer);
    }),

  /**
   * Answers uploads to photo storage with `status` (S3 answers 204 to an
   * upload it takes). `uploads` collects each upload's form.
   */
  photoStorage: (status: number, uploads: FormData[] = []) =>
    http.post(PHOTO_STORAGE_URL, async ({ request }) => {
      uploads.push(await formDataOf(request));
      return new HttpResponse(null, { status });
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

  /**
   * Answers cart requests with `cart` (or what it returns at the time, for a
   * cart that changes). `requests` collects each request's URL, so a test can
   * check the locale the page asked for. test/server.ts answers with an empty
   * cart unless a test says otherwise.
   */
  cart: (cart: Cart | (() => Cart), requests: URL[] = []) =>
    http.get(api.cart.$url().href, ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(typeof cart === 'function' ? cart() : cart);
    }),

  /** Answers cart requests with a server error, as when the API is unavailable. */
  cartFails: () => http.get(api.cart.$url().href, () => HttpResponse.json({ error: 'internal' }, { status: 500 })),

  /** Answers requests to add to the cart with `answer`; `requests` collects each request. */
  cartAdd: (answer: CartChangeReply<CartAddRefusal, CartAddNotFound>, requests: Request[] = []) =>
    http.post(cartLinesUrl, ({ request }) => {
      requests.push(request);
      return HttpResponse.json(answer.body, { status: answer.status });
    }),

  /** The next request to add to the cart fails as if the network were down; later ones go on to other handlers. */
  cartAddUnreachable: () => http.post(cartLinesUrl, () => HttpResponse.error(), { once: true }),

  /** Answers requests to change a cart line's quantity with `answer`; `requests` collects each request. */
  cartSetQuantity: (answer: CartChangeReply<CartQuantityRefusal, CartLineNotInCart>, requests: Request[] = []) =>
    http.put(`${cartLinesUrl}/:lineId`, ({ request }) => {
      requests.push(request);
      return HttpResponse.json(answer.body, { status: answer.status });
    }),

  /** Answers requests to remove a cart line with `cart`, the cart without it; `requests` collects each request. */
  cartRemove: (cart: Cart, requests: Request[] = []) =>
    http.delete(`${cartLinesUrl}/:lineId`, ({ request }) => {
      requests.push(request);
      return HttpResponse.json(cart);
    }),

  /**
   * Answers product page requests with the page for the requested slug (from
   * what `pages` returns at the time, for pages that change); 404 for any other product.
   */
  productPages: (pages: Record<string, ProductPage> | (() => Record<string, ProductPage>)) =>
    http.get(`${productsUrl}/:slug`, ({ params }) => {
      const page = (typeof pages === 'function' ? pages() : pages)[String(params.slug)];
      return page ? HttpResponse.json(page) : HttpResponse.json(notFound, { status: 404 });
    }),
};
