import type { InferResponseType } from 'hono/client';
import { http, HttpResponse } from 'msw/http';
import { api, type HomeData } from '../api';
import type { Locale } from '../i18n/locales';

// Mock bodies are typed by the API's own route types, so they cannot drift from the real responses.

export const emptyHomeData: HomeData = { newArrivals: [], categories: [] };

const unsupportedLocale: InferResponseType<typeof api.home.$get, 400> = {
  error: 'unsupported_locale',
  supportedLocales: ['ja', 'zh', 'en'],
};

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
};
