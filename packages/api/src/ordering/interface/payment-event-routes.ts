import { Hono } from 'hono';
import type { HandlePaymentEvent } from '../application/payment-events';

/**
 * The payment service's webhook: it POSTs each payment event here, signed.
 * The body is verified as it arrived, byte for byte, before anything reads it.
 * Any answer but a 2xx makes the service deliver the event again later.
 */
export function paymentEventRoutes(deps: { handlePaymentEvent: HandlePaymentEvent }) {
  return new Hono().post('/', async (c) => {
    switch (await deps.handlePaymentEvent({ payload: await c.req.text(), headers: c.req.raw.headers })) {
      case 'invalid':
        return c.json({ error: 'invalid_signature' } as const, 400);
      case 'done':
        return c.json({ received: true } as const, 200);
      case 'try_again':
        return c.json({ error: 'try_again_later' } as const, 503);
    }
  });
}
