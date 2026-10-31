import type { ReleaseStock, SellReservedStock } from '../../catalog/application/stock-reservations';
import type { Clock } from '../../shared-kernel/clock';
import type { StartUnitOfWork } from '../../shared-kernel/unit-of-work';
import type { GetOwnerNotifications } from '../../store/application/get-owner-notifications';
import type { Email, Mailer } from '../domain/mailer';
import { payOrder, type Order, type OrderEmail, type OrderRepository } from '../domain/order';
import type { OrderPageUrls } from '../domain/order-page-urls';
import type { PaymentEvent, Payments } from '../domain/payments';
import { endCheckout } from './checkout';
import { newOrderNoticeEmail, orderConfirmationEmail } from './order-emails';

/**
 * How many times an event is applied again, the order read anew, when
 * something changed the order or its products meanwhile.
 */
const ATTEMPTS = 3;

/** The emails a paid order sends, in this order. */
const PAID_ORDER_EMAILS: readonly OrderEmail[] = ['order_confirmation', 'new_order_notice'];

/**
 * What handling payment events needs: its own adapters, of the catalog its
 * stock, and of the store settings where the owner's notices go.
 */
type Deps = {
  payments: Payments;
  orders: OrderRepository;
  startUnitOfWork: StartUnitOfWork;
  sellReservedStock: SellReservedStock;
  releaseStock: ReleaseStock;
  ownerNotifications: GetOwnerNotifications;
  mailer: Mailer;
  orderPageUrls: OrderPageUrls;
  clock: Clock;
};

export type PaymentEventHandling =
  /** The request is not from the payment service: nothing is done. */
  | 'invalid'
  /** The event is handled, or it needs nothing (more): the service need not deliver it again. */
  | 'done'
  /** Part of it could not be done now (an email could not be sent): the service should deliver it again. */
  | 'try_again';

export type HandlePaymentEvent = (delivery: { payload: string; headers: Headers }) => Promise<PaymentEventHandling>;

/**
 * Use case: the payment service reports what became of a checkout, in a
 * request to the webhook (its body `payload`, and `headers`), which must be
 * signed by the service. The service may deliver an event more than once; each changes the order (and
 * its stock) at most once, and each email goes once, as the order records.
 * An event that does not fit the order's status is logged and ignored.
 */
export function handlePaymentEvent(deps: Deps): HandlePaymentEvent {
  return async ({ payload, headers }) => {
    const event = await deps.payments.verifyEvent(payload, headers);
    if (event === 'invalid') return 'invalid';
    switch (event.type) {
      case 'checkout_completed':
        return checkoutPaid(deps, event);
      case 'checkout_expired':
        await checkoutExpired(deps, event);
        return 'done';
      case 'other':
        return 'done';
    }
  };
}

/**
 * The customer paid: the order is paid, with the customer's details, and its
 * reserved stock sold, together. Then the customer gets the order
 * confirmation, and the owner the new order notice, those not sent yet.
 */
async function checkoutPaid(
  deps: Deps,
  event: Extract<PaymentEvent, { type: 'checkout_completed' }>,
): Promise<PaymentEventHandling> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const order = await deps.orders.byId(event.orderId);
    if (!order) return ignored(event, 'no such order');
    if (order.status === 'paid') return sendPaidOrderEmails(deps, order);
    // An expired order's payment page cannot be paid (it expires first), so a payment for one is a surprise.
    if (order.status !== 'pending_payment') return ignored(event, `the order is ${order.status}`);

    const paid = payOrder(order, { customer: event.customer, paidAt: deps.clock.now() });
    if (!paid) return 'done';
    const unit = deps.startUnitOfWork();
    await deps.sellReservedStock({ unit, quantities: paid.lines });
    deps.orders.updateIn(unit, paid);
    if ((await unit.commit()) === 'committed') {
      return sendPaidOrderEmails(deps, { ...paid, version: paid.version + 1 });
    }
  }
  throw new Error(`Could not record the payment of order ${event.orderId}`);
}

/**
 * The payment page expired unpaid: the order expires and its stock is
 * released. An order the customer cancelled expired already.
 */
async function checkoutExpired(deps: Deps, event: Extract<PaymentEvent, { type: 'checkout_expired' }>) {
  const order = await deps.orders.byId(event.orderId);
  if (!order) return ignored(event, 'no such order');
  if (order.status !== 'pending_payment') {
    if (order.status !== 'expired') ignored(event, `the order is ${order.status}`);
    return;
  }
  await endCheckout(deps, order);
}

/** Logs that `event` does not fit its order, which it leaves as it is. */
function ignored(event: Extract<PaymentEvent, { orderId: string }>, why: string): 'done' {
  console.warn('Ignored a payment event that does not fit its order', {
    eventId: event.id,
    type: event.type,
    orderId: event.orderId,
    why,
  });
  return 'done';
}

/**
 * Sends the paid order's emails not sent yet, recording each on the order as
 * it goes. If one fails, the rest wait for the event to be delivered again.
 */
async function sendPaidOrderEmails(deps: Deps, paid: Order): Promise<PaymentEventHandling> {
  let order = paid;
  for (const kind of PAID_ORDER_EMAILS) {
    if (order.sentEmails.includes(kind)) continue;
    const email = await emailOf(deps, kind, order);
    if (email) {
      try {
        await deps.mailer.send(email);
      } catch (error) {
        console.error('Sending an email about an order failed', { orderId: order.id, email: kind, error });
        return 'try_again';
      }
    }
    const stored = await deps.orders.update({ ...order, sentEmails: [...order.sentEmails, kind] });
    if (stored === 'stale') throw new Error(`Order ${order.id} changed while its emails were sent`);
    order = stored;
  }
  return 'done';
}

/** The email `kind` about the paid `order`; undefined when it has no one to go to. */
async function emailOf(deps: Deps, kind: OrderEmail, order: Order): Promise<Email | undefined> {
  const { customer } = order;
  if (!customer) throw new Error(`Paid order ${order.id} has no customer`);
  switch (kind) {
    case 'order_confirmation':
      return orderConfirmationEmail(order, customer, deps.orderPageUrls.status(order.locale, order));
    case 'new_order_notice': {
      const owner = await deps.ownerNotifications();
      return owner.email ? newOrderNoticeEmail(order, customer, owner.email) : undefined;
    }
  }
}
