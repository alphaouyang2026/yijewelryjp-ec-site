import { http, HttpResponse } from 'msw/http';
import { api, type HomeData } from '../api';

// Mock bodies are typed by the API's own route types, so they cannot drift from the real responses.

export const emptyHomeData: HomeData = { newArrivals: [], categories: [] };

/** MSW handlers for the API routes, at the URLs the RPC client calls. */
export const mockApi = {
  home: (data: HomeData) => http.get(api.home.$url().href, () => HttpResponse.json(data)),
};
