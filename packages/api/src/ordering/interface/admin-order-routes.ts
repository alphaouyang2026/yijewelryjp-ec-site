import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';
import { jsonBody } from '../../interface/json-body';
import { localeQuery } from '../../interface/locale-query';
import {
  CARRIERS,
  ORDER_STATUSES,
  type GetAdminOrder,
  type ListAdminOrders,
  type SendShippingNotice,
  type ShipOrder,
} from '../application/manage-orders';

/** The list's optional status; any other value gets 400 invalid_query. */
const orderListQuery = zValidator('query', z.object({ status: z.enum(ORDER_STATUSES).optional() }), (result, c) => {
  if (!result.success) return c.json({ error: 'invalid_query' } as const, 400);
});

/** Carriers' names and tracking numbers are short; Japanese carriers' numbers have at most 12 to 16 digits. */
const SHIPMENT_TEXT_MAX = 40;

const shipmentText = z
  .string({ error: 'required' })
  .trim()
  .max(SHIPMENT_TEXT_MAX, { error: 'too_long' });

/**
 * What the shipment form sends, its texts trimmed: the order's version the
 * owner saw, the carrier, its name for 'other' (required then, and ignored
 * for any other), and the tracking number. Each error is a field error code.
 */
const shipmentBody = jsonBody(
  z
    .object({
      version: z.number({ error: 'invalid' }).int({ error: 'invalid' }),
      carrier: z.enum(CARRIERS, { error: 'invalid' }),
      carrierName: shipmentText.optional(),
      trackingNumber: shipmentText.min(1, { error: 'required' }),
    })
    .superRefine((shipment, context) => {
      if (shipment.carrier === 'other' && !shipment.carrierName) {
        context.addIssue({ code: 'custom', path: ['carrierName'], message: 'required' });
      }
    }),
);

/** The admin's orders, behind the owner-only guard (mounted in the admin route group). */
export function adminOrderRoutes(useCases: {
  listAdminOrders: ListAdminOrders;
  getAdminOrder: GetAdminOrder;
  shipOrder: ShipOrder;
  sendShippingNotice: SendShippingNotice;
}) {
  return (
    new Hono()
      .get('/', orderListQuery, async (c) => c.json(await useCases.listAdminOrders(c.req.valid('query')), 200))
      .get('/:orderNumber', localeQuery, async (c) => {
        const order = await useCases.getAdminOrder({
          orderNumber: c.req.param('orderNumber'),
          locale: c.req.valid('query').locale,
        });
        return order ? c.json(order, 200) : c.json({ error: 'not_found' } as const, 404);
      })
      // The answer is the shipped order in Japanese, the admin's default locale; the admin reloads it in its own.
      .post('/:orderNumber/shipment', shipmentBody, async (c) => {
        const shipping = await useCases.shipOrder({
          orderNumber: c.req.param('orderNumber'),
          ...c.req.valid('json'),
          locale: 'ja',
        });
        switch (shipping.outcome) {
          case 'shipped':
            return c.json(shipping.order, 200);
          case 'not_found':
            return c.json({ error: 'not_found' } as const, 404);
          case 'stale':
            return c.json({ error: 'stale_version' } as const, 409);
          case 'invalid_status_transition':
            return c.json({ error: 'invalid_status_transition' } as const, 409);
        }
      })
      // Sends again a shipping notice that could not be sent; the answer is the order, as for shipping it.
      .post('/:orderNumber/shipping-notice', async (c) => {
        const sending = await useCases.sendShippingNotice({ orderNumber: c.req.param('orderNumber'), locale: 'ja' });
        switch (sending.outcome) {
          case 'sent':
            return c.json(sending.order, 200);
          case 'not_found':
            return c.json({ error: 'not_found' } as const, 404);
          case 'invalid_status_transition':
            return c.json({ error: 'invalid_status_transition' } as const, 409);
        }
      })
  );
}
