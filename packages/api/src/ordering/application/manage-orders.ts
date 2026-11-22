import type { Clock } from '../../shared-kernel/clock';
import type { Locale } from '../../shared-kernel/locale';
import type { Mailer } from '../domain/mailer';
import { shipOrder as shippedOrder, type Carrier, type Order, type OrderRepository, type OrderStatus } from '../domain/order';
import type { OrderPageUrls } from '../domain/order-page-urls';
import { shippingNoticeEmail } from './order-emails';
import { orderPageView, type OrderPageView } from './order-page';

export { CARRIERS, ORDER_STATUSES } from '../domain/order';

/** The statuses of the orders the owner has nothing to do for: pending payment and expired. */
const NOTHING_TO_DO: readonly OrderStatus[] = ['pending_payment', 'expired'];

/** An order in the admin's list. */
export type AdminOrderSummary = {
  orderNumber: string;
  status: OrderStatus;
  placedAt: string;
  /** Who receives the parcel; null until the order is paid. */
  recipient: string | null;
  /** How many pieces the order has, of every line. */
  quantity: number;
  totalYen: number;
};

export type ListAdminOrders = (query: {
  /** Only orders in this status; without it, those the owner has something to do for. */
  status?: OrderStatus;
}) => Promise<{ orders: AdminOrderSummary[] }>;

/**
 * Use case: the admin's order list, the most recent first: the orders in one
 * status, or without it those the owner has something to do for.
 */
export function listAdminOrders(deps: { orders: OrderRepository }): ListAdminOrders {
  return async ({ status }) => {
    const shown = (order: Order) => (status ? order.status === status : !NOTHING_TO_DO.includes(order.status));
    return { orders: (await deps.orders.latestFirst()).filter(shown).map(adminOrderSummary) };
  };
}

/**
 * An order as the admin shows it: as the order page does, and also the
 * locale the customer ordered in, how to reach them (null until paid),
 * whether the customer was told it shipped, and its version, which a change
 * to it names.
 */
export type AdminOrderView = OrderPageView & {
  orderedIn: Locale;
  email: string | null;
  phone: string | null;
  /** Whether the customer has been sent the shipping notice; false for an order not shipped. */
  shippingNoticeSent: boolean;
  version: number;
};

export type GetAdminOrder = (query: { orderNumber: string; locale: Locale }) => Promise<AdminOrderView | undefined>;

/** Query: one order, in any status, its texts in the owner's `locale`. Undefined if no order has the number. */
export function getAdminOrder(deps: { orders: OrderRepository }): GetAdminOrder {
  return async ({ orderNumber, locale }) => {
    const order = await deps.orders.byId(orderNumber);
    return order && adminOrderView(order, locale);
  };
}

export type ShipOrder = (command: {
  orderNumber: string;
  /** The version the owner saw. */
  version: number;
  carrier: Carrier;
  /** For 'other' only. */
  carrierName?: string;
  trackingNumber: string;
  /** The locale of the order the answer has. */
  locale: Locale;
}) => Promise<
  | { outcome: 'shipped'; order: AdminOrderView }
  /** No order has the number. */
  | { outcome: 'not_found' }
  /** The order changed since the owner saw it: nothing is shipped. */
  | { outcome: 'stale' }
  /** Only a paid order can ship. */
  | { outcome: 'invalid_status_transition' }
>;

type ShippingDeps = { orders: OrderRepository; mailer: Mailer; orderPageUrls: OrderPageUrls };

/**
 * Use case: the owner ships a paid order, by a carrier with a tracking
 * number; then the customer is sent the shipping notice. A notice the mail
 * service cannot send leaves the order shipped, to send again.
 */
export function shipOrder(deps: ShippingDeps & { clock: Clock }): ShipOrder {
  return async ({ orderNumber, version, carrier, carrierName, trackingNumber, locale }) => {
    const order = await deps.orders.byId(orderNumber);
    if (!order) return { outcome: 'not_found' };
    if (order.version !== version) return { outcome: 'stale' };
    const shipped = shippedOrder(order, {
      carrier,
      carrierName: carrier === 'other' ? carrierName : undefined,
      trackingNumber,
      shippedAt: deps.clock.now(),
    });
    if (!shipped) return { outcome: 'invalid_status_transition' };
    const stored = await deps.orders.update(shipped);
    if (stored === 'stale') return { outcome: 'stale' };
    return { outcome: 'shipped', order: adminOrderView(await withShippingNotice(deps, stored), locale) };
  };
}

export type SendShippingNotice = (command: { orderNumber: string; locale: Locale }) => Promise<
  | { outcome: 'sent'; order: AdminOrderView }
  | { outcome: 'not_found' }
  /** Only a shipped order has a notice to send. */
  | { outcome: 'invalid_status_transition' }
>;

/**
 * Use case: the owner sends a shipped order's notice that could not be sent
 * when it shipped. Sent once: a notice sent already is not sent again.
 */
export function sendShippingNotice(deps: ShippingDeps): SendShippingNotice {
  return async ({ orderNumber, locale }) => {
    const order = await deps.orders.byId(orderNumber);
    if (!order) return { outcome: 'not_found' };
    if (order.status !== 'shipped') return { outcome: 'invalid_status_transition' };
    return { outcome: 'sent', order: adminOrderView(await withShippingNotice(deps, order), locale) };
  };
}

/**
 * The shipped `order` once the customer has been sent its notice, recorded
 * on it; as it is if it went already, or if the mail service fails (logged).
 */
async function withShippingNotice(deps: ShippingDeps, order: Order): Promise<Order> {
  const { customer, shipment } = order;
  if (order.sentEmails.includes('shipping_notice')) return order;
  if (!customer || !shipment) throw new Error(`Shipped order ${order.id} has no customer or shipment`);
  try {
    await deps.mailer.send(shippingNoticeEmail(order, customer, shipment, deps.orderPageUrls.status(order.locale, order)));
  } catch (error) {
    console.error('Sending an email about an order failed', { orderId: order.id, email: 'shipping_notice', error });
    return order;
  }
  const stored = await deps.orders.update({ ...order, sentEmails: [...order.sentEmails, 'shipping_notice'] });
  if (stored === 'stale') throw new Error(`Order ${order.id} changed while its shipping notice was sent`);
  return stored;
}

function adminOrderView(order: Order, locale: Locale): AdminOrderView {
  return {
    ...orderPageView(order, locale),
    orderedIn: order.locale,
    email: order.customer?.email ?? null,
    phone: order.customer?.phone ?? null,
    shippingNoticeSent: order.sentEmails.includes('shipping_notice'),
    version: order.version,
  };
}

function adminOrderSummary(order: Order): AdminOrderSummary {
  return {
    orderNumber: order.id,
    status: order.status,
    placedAt: order.placedAt.toISOString(),
    recipient: order.customer?.shippingAddress.name ?? null,
    quantity: order.lines.reduce((sum, line) => sum + line.quantity, 0),
    totalYen: order.total.yen,
  };
}
