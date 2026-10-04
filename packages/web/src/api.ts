import type { AppType } from '@yi/api';
import { hc } from 'hono/client';

/** Typed client for the API, which is served under /api on the site's own origin. */
export const api = hc<AppType>(window.location.origin).api;
