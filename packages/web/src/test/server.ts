import { setupServer } from 'msw/node';
import { emptyCart, mockApi } from './api-mocks';

/**
 * Intercepts the app's /api requests at the network level. Tests add handlers
 * with `server.use(...)`. Every store page's frame asks for the cart (for the
 * header's count), so the cart is empty unless a test says otherwise; this
 * handler stays when the tests' handlers are reset.
 */
export const server = setupServer(mockApi.cart(emptyCart));
