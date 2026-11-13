import { Hono } from 'hono';
import * as z from 'zod';
import { localeQueryWith } from '../../interface/locale-query';
import type { GetOrderPage } from '../application/order-page';

/**
 * The order page's order, in the requested locale. It takes the order's
 * checkout token, which the order confirmation's link carries; a missing or
 * wrong one gets 404, as for no such order.
 */
export function orderRoutes(deps: { getOrderPage: GetOrderPage }) {
  return new Hono().get('/:orderId', localeQueryWith({ token: z.string().catch('') }), async (c) => {
    const { locale, token } = c.req.valid('query');
    const order = await deps.getOrderPage({ orderId: c.req.param('orderId'), token, locale });
    return order ? c.json(order, 200) : c.json({ error: 'not_found' } as const, 404);
  });
}
