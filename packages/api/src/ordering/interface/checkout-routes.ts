import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';
import { jsonBody } from '../../interface/json-body';
import { localeQuery } from '../../interface/locale-query';
import type { CancelCheckout, FindCheckoutOrder, StartCheckout } from '../application/checkout';
import type { CartCookie } from './cart-cookie';
import { lineIdOf } from './cart-input';

/** The checkout token the payment page's return URL carries; a missing one (or anything else) matches no order. */
const tokenQuery = zValidator('query', z.object({ token: z.string().catch('') }));

/**
 * Checkout. Starting it reads the cart from its cookie and leaves the cookie
 * as it is: the cart stays until the order is paid, and the thank-you page
 * then takes what the order bought out of it. No CSRF token, as for the
 * cart: a POST from another site's form is a cross-site navigation, which
 * does not carry the SameSite=Lax cart cookie, so it checks out an empty cart.
 * The routes under /orders/:orderId take the checkout token the payment
 * page's return URLs carry; any other token gets 404, as for no such order.
 * Cancelling takes it as JSON, which no other site's form can send.
 */
export function checkoutRoutes(deps: {
  startCheckout: StartCheckout;
  findCheckoutOrder: FindCheckoutOrder;
  cancelCheckout: CancelCheckout;
  cartCookie: CartCookie;
}) {
  return (
    new Hono()
      .post('/', localeQuery, async (c) => {
        const start = await deps.startCheckout({
          locale: c.req.valid('query').locale,
          cart: await deps.cartCookie.read(c),
        });
        switch (start.outcome) {
          case 'started':
            return c.json({ url: start.url }, 200);
          case 'cart_empty':
            return c.json({ error: 'cart_empty' } as const, 409);
          case 'unavailable':
            return c.json(
              {
                error: 'unavailable_lines',
                lines: start.lines.map((line) => ({
                  lineId: lineIdOf(line),
                  name: line.name,
                  variantLabel: line.variantLabel,
                  availableStock: line.availableStock,
                })),
              } as const,
              409,
            );
          case 'payment_unavailable':
            return c.json({ error: 'payment_unavailable' } as const, 502);
          case 'busy':
            return c.json({ error: 'checkout_busy' } as const, 503);
        }
      })
      // The thank-you page's order. Once it is paid, what it bought leaves the cart.
      .get('/orders/:orderId', tokenQuery, async (c) => {
        const cart = await deps.cartCookie.read(c);
        const found = await deps.findCheckoutOrder({
          orderId: c.req.param('orderId'),
          token: c.req.valid('query').token,
          cart,
        });
        if (!found) return c.json({ error: 'not_found' } as const, 404);
        if (found.cart.lines.length !== cart.lines.length) await deps.cartCookie.write(c, found.cart);
        return c.json(found.order, 200);
      })
      // The customer left the payment page without paying.
      .post('/orders/:orderId/cancel', jsonBody(z.object({ token: z.string() })), async (c) => {
        const cancellation = await deps.cancelCheckout({
          orderId: c.req.param('orderId'),
          token: c.req.valid('json').token,
        });
        switch (cancellation) {
          case 'ended':
          case 'paid':
            return c.body(null, 204);
          case 'not_found':
            return c.json({ error: 'not_found' } as const, 404);
          case 'payment_unavailable':
            return c.json({ error: 'payment_unavailable' } as const, 502);
        }
      })
  );
}
