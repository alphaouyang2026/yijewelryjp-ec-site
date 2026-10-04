import type { AppType } from '@yi/api';
import { hc, type InferResponseType } from 'hono/client';

/** Typed client for the API, which is served under /api on the site's own origin. */
export const api = hc<AppType>(window.location.origin).api;

// Response types come from the API's routes; never redeclare them by hand.
export type HomeData = InferResponseType<typeof api.home.$get, 200>;
export type Category = HomeData['categories'][number];
