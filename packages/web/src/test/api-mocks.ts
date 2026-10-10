import type { InferResponseType } from 'hono/client';
import { http, HttpResponse } from 'msw/http';
import { api, type HomeData, type ProductList, type ProductPage } from '../api';
import type { Locale } from '../i18n/locales';

// Mock bodies are typed by the API's own route types, so they cannot drift from the real responses.

export const emptyHomeData: HomeData = { featured: null, newArrivals: [], categories: [] };

const unsupportedLocaleBody = { error: 'unsupported_locale', supportedLocales: ['ja', 'zh', 'en'] };
const unsupportedLocale: InferResponseType<typeof api.home.$get, 400> = unsupportedLocaleBody;
const notFound: InferResponseType<(typeof api.products)[':slug']['$get'], 404> = { error: 'not_found' };

const productsUrl = api.products.$url().href;

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

  /** Answers product page requests with the page for the requested slug; 404 for any other product. */
  productPages: (pages: Record<string, ProductPage>) =>
    http.get(`${productsUrl}/:slug`, ({ params }) => {
      const page = pages[String(params.slug)];
      return page ? HttpResponse.json(page) : HttpResponse.json(notFound, { status: 404 });
    }),
};
