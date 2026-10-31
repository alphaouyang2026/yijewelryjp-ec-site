import type { ReleaseStock, ReserveStock, UnavailableVariant } from '../../catalog/application/stock-reservations';
import type { Clock } from '../../shared-kernel/clock';
import type { Locale } from '../../shared-kernel/locale';
import { textIn } from '../../shared-kernel/localized-text';
import { isSameToken, randomToken } from '../../shared-kernel/random-token';
import type { StartUnitOfWork } from '../../shared-kernel/unit-of-work';
import type { GetShippingRates } from '../../store/application/get-shipping-rates';
import { removeLine, type Cart } from '../domain/cart';
import type { OrderPageUrls } from '../domain/order-page-urls';
import {
  expireOrder,
  newOrderNumber,
  placeOrder,
  type Order,
  type OrderLine,
  type OrderRepository,
  type OrderStatus,
} from '../domain/order';
import type { CheckoutSession, Payments } from '../domain/payments';

/**
 * How long the payment page stays open. Stripe lets a session expire no
 * sooner than 30 minutes after it creates it, by its own clock; the extra
 * minute keeps a session created a moment after `now` (or on a clock a little
 * behind Stripe's) from being refused for expiring too soon.
 */
const PAYMENT_WINDOW_MS = 31 * 60 * 1000;

/**
 * How many times checkout reads the catalog again and retries when another
 * checkout (or the owner) changed a product it reserves stock of meanwhile.
 */
const ATTEMPTS = 3;

/**
 * What checkout needs: its own adapters, and of the other contexts the
 * catalog's stock and the store's shipping rates.
 */
type Deps = {
  orders: OrderRepository;
  payments: Payments;
  orderPageUrls: OrderPageUrls;
  startUnitOfWork: StartUnitOfWork;
  reserveStock: ReserveStock;
  releaseStock: ReleaseStock;
  shippingRates: GetShippingRates;
  clock: Clock;
};

/** A cart line checkout refused, as the customer sees it: texts in the requested locale. */
export type UnavailableLineView = {
  productSlug: string;
  sku: string;
  name: string;
  /** Null when the product no longer has the variant. */
  variantLabel: string | null;
  /** How many of it can be bought now: none for a product no longer on sale. */
  availableStock: number;
};

export type CheckoutStart =
  /** The order is created and its stock reserved: the customer goes on to `url`, the payment page. */
  | { outcome: 'started'; url: string }
  /** Nothing to check out: the cart has no lines (or only lines of products that no longer exist). */
  | { outcome: 'cart_empty' }
  /** Some lines cannot be bought as they are; nothing is reserved. */
  | { outcome: 'unavailable'; lines: UnavailableLineView[] }
  /** The payment service failed to create the payment page; the stock was released at once. */
  | { outcome: 'payment_unavailable' }
  /** Other checkouts kept changing the same products; nothing is reserved. Trying again may work. */
  | { outcome: 'busy' };

export type StartCheckout = (command: { locale: Locale; cart: Cart }) => Promise<CheckoutStart>;

/**
 * Use case: the customer checks out their cart. Every line must be buyable
 * as it is, at its quantity, or nothing happens. The order (a snapshot of the
 * lines at the catalog's prices now, in the customer's locale) is created and
 * the lines' stock reserved in one unit of work, all or nothing; then the
 * payment service creates the payment page. If it fails to, the checkout ends
 * at once: the order expires and its stock is released.
 */
export function startCheckout(deps: Deps): StartCheckout {
  return async ({ locale, cart }) => {
    if (cart.lines.length === 0) return { outcome: 'cart_empty' };

    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const unit = deps.startUnitOfWork();
      const [reservation, rates] = await Promise.all([
        deps.reserveStock({ unit, quantities: cart.lines }),
        deps.shippingRates(),
      ]);
      if (reservation.outcome === 'unavailable') {
        return {
          outcome: 'unavailable',
          lines: reservation.variants.map((variant) => unavailableLine(variant, locale)),
        };
      }

      const lines = cart.lines.flatMap((line, index): OrderLine[] => {
        const variant = reservation.variants[index];
        if (!variant) return [];
        const { productSlug, sku, quantity } = line;
        const { productName, variantLabel, price } = variant;
        return [{ productSlug, sku, productName, variantLabel, unitPrice: price, quantity }];
      });
      if (lines.length === 0) return { outcome: 'cart_empty' };

      const now = deps.clock.now();
      const order = placeOrder({
        id: newOrderNumber(now),
        locale,
        lines,
        rates,
        placedAt: now,
        checkoutToken: randomToken(),
      });
      deps.orders.addIn(unit, order);
      if ((await unit.commit()) === 'conflict') continue;

      let session: CheckoutSession;
      try {
        session = await createPaymentPage(deps, order, now);
      } catch (error) {
        console.error('Creating the payment page failed', { orderId: order.id, error });
        await endCheckout(deps, order);
        return { outcome: 'payment_unavailable' };
      }
      const stored = await deps.orders.update({ ...order, checkoutSessionId: session.id });
      if (stored === 'stale') throw new Error(`Order ${order.id} changed before its checkout session was kept`);
      return { outcome: 'started', url: session.url };
    }
    return { outcome: 'busy' };
  };
}

/**
 * Ends a checkout that will not be paid: the order expires and its stock is
 * released, together. Nothing happens to an order no longer pending payment.
 * Reads the order again and retries when something changed it, or the
 * products, meanwhile.
 */
export async function endCheckout(
  deps: Pick<Deps, 'orders' | 'startUnitOfWork' | 'releaseStock'>,
  order: Order,
): Promise<void> {
  let current: Order | undefined = order;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const expired = current && expireOrder(current);
    if (!expired) return;
    const unit = deps.startUnitOfWork();
    await deps.releaseStock({ unit, quantities: expired.lines });
    deps.orders.updateIn(unit, expired);
    if ((await unit.commit()) === 'committed') return;
    current = await deps.orders.byId(order.id);
  }
  throw new Error(`Could not release the stock of order ${order.id}`);
}

/** Has the payment service create the order's payment page (a checkout session). */
function createPaymentPage(deps: Deps, order: Order, now: Date): Promise<CheckoutSession> {
  return deps.payments.createCheckoutSession({
    orderId: order.id,
    locale: order.locale,
    lines: order.lines.map((line) => ({
      name: textIn(line.productName, order.locale),
      variantLabel: textIn(line.variantLabel, order.locale),
      unitPrice: line.unitPrice,
      quantity: line.quantity,
    })),
    shippingFee: order.shipping,
    successUrl: deps.orderPageUrls.completed(order.locale, order),
    cancelUrl: deps.orderPageUrls.cancelled(order.locale, order),
    expiresAt: new Date(now.getTime() + PAYMENT_WINDOW_MS),
  });
}

function unavailableLine(variant: UnavailableVariant, locale: Locale): UnavailableLineView {
  return {
    productSlug: variant.productSlug,
    sku: variant.sku,
    name: textIn(variant.productName, locale),
    variantLabel: variant.variantLabel ? textIn(variant.variantLabel, locale) : null,
    availableStock: variant.availableStock,
  };
}

/** An order as the thank-you page shows it. */
export type CheckoutOrderView = { orderNumber: string; status: OrderStatus };

export type FindCheckoutOrder = (query: {
  orderId: string;
  token: string;
  cart: Cart;
}) => Promise<{ order: CheckoutOrderView; cart: Cart } | undefined>;

/**
 * Query: the order the payment page's return URL names, for the thank-you
 * page. Only with the order's checkout token, which only the customer who
 * started the checkout has; undefined for any other. With it, the customer's
 * `cart` without what the order bought once it is paid (and as it is until
 * then), so the cart no longer has it but keeps what was added since.
 */
export function findCheckoutOrder(deps: { orders: OrderRepository }): FindCheckoutOrder {
  return async ({ orderId, token, cart }) => {
    const order = await deps.orders.byId(orderId);
    if (!order || !isSameToken(token, order.checkoutToken)) return undefined;
    return {
      order: { orderNumber: order.id, status: order.status },
      cart: order.paidAt ? order.lines.reduce(removeLine, cart) : cart,
    };
  };
}

export type CheckoutCancellation =
  /** The checkout has ended: its order expired and its stock released, now or before. */
  | 'ended'
  /** The customer has already paid: the order keeps its stock, and the payment's event will settle it. */
  | 'paid'
  /** No order has the number with the token. */
  | 'not_found'
  /** The payment service could not end the session, so nothing was released: it may still be paid. */
  | 'payment_unavailable';

export type CancelCheckout = (command: { orderId: string; token: string }) => Promise<CheckoutCancellation>;

/**
 * Use case: the customer left the payment page without paying, and the
 * checkout ends at once, so its stock is available again (also to the
 * customer, whose cart still has it). The payment service first ends the
 * session, so it can never be paid; then the order expires and its stock is
 * released. Only with the order's checkout token, from the payment page's
 * return URL. An order no longer pending payment is left as it is.
 */
export function cancelCheckout(deps: Deps): CancelCheckout {
  return async ({ orderId, token }) => {
    const order = await deps.orders.byId(orderId);
    if (!order || !isSameToken(token, order.checkoutToken)) return 'not_found';
    // Without a session the payment page was never created (and the checkout
    // already ended), or creating it failed only to be kept on the order:
    // then the session's expiry ends the checkout, as the payment service reports it.
    if (order.status !== 'pending_payment' || !order.checkoutSessionId) return 'ended';

    let session: 'expired' | 'completed';
    try {
      session = await deps.payments.expireCheckoutSession(order.checkoutSessionId);
    } catch (error) {
      console.error('Ending the checkout session failed', { orderId: order.id, error });
      return 'payment_unavailable';
    }
    if (session === 'completed') return 'paid';
    await endCheckout(deps, order);
    return 'ended';
  };
}
