import { setupServer } from 'msw/node';

/** Intercepts the app's /api requests at the network level. Tests add handlers with `server.use(...)`. */
export const server = setupServer();
