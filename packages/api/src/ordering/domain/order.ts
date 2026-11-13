import type { Locale } from '../../shared-kernel/locale';
import type { LocalizedText } from '../../shared-kernel/localized-text';
import { yen, type Money } from '../../shared-kernel/money';
import type { UnitOfWork } from '../../shared-kernel/unit-of-work';
import { shippingFor, type ShippingRates } from './cart';

/**
 * Pending payment: checkout started, its stock reserved. Paid: the payment
 * service reported the payment. Expired: the checkout ended without one, its
 * stock released. Shipped and cancelled: the owner shipped or cancelled it.
 */
export const ORDER_STATUSES = ['pending_payment', 'paid', 'expired', 'shipped', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * The emails about an order: once it is paid, the customer's order
 * confirmation and the owner's new order notice. Each is sent once.
 */
export type OrderEmail = 'order_confirmation' | 'new_order_notice';

/** A line of an order: a variant and how many, as the catalog had it when checkout started (the snapshot). */
export type OrderLine = {
  readonly productSlug: string;
  readonly sku: string;
  readonly productName: LocalizedText;
  readonly variantLabel: LocalizedText;
  /** Tax-inclusive. */
  readonly unitPrice: Money;
  readonly quantity: number;
};

/** Where an order is shipped, in Japan: as the customer entered it on the payment page. */
export type ShippingAddress = {
  /** Who receives the parcel. */
  readonly name: string;
  readonly postalCode: string;
  readonly prefecture: string;
  /** The city, ward, town or village. */
  readonly city: string;
  /** The rest of the address: the district and block number. */
  readonly line1: string;
  /** The building and room, if any. */
  readonly line2?: string;
};

/** The customer of a paid order: the contact details and address they gave on the payment page. */
export type Customer = {
  readonly email: string;
  readonly phone?: string;
  readonly shippingAddress: ShippingAddress;
};

/**
 * An order: created when the customer starts checkout, with a snapshot of its
 * lines and prices, the locale the customer ordered in, and its amounts.
 */
export type Order = {
  /** The order number customers and the owner see; also the order's key (see `newOrderNumber`). */
  readonly id: string;
  readonly status: OrderStatus;
  /** The locale the customer ordered in: the payment page's, and later the emails'. */
  readonly locale: Locale;
  readonly lines: readonly OrderLine[];
  readonly subtotal: Money;
  readonly shipping: Money;
  /** Subtotal plus shipping: what the customer pays. */
  readonly total: Money;
  readonly placedAt: Date;
  /**
   * The secret the payment page's return URLs carry, so only the customer who
   * started this checkout can look the order up or cancel it from them.
   */
  readonly checkoutToken: string;
  /** The payment service's checkout session; undefined until it is created. */
  readonly checkoutSessionId?: string;
  /** Who paid, from the payment page; undefined until the order is paid. */
  readonly customer?: Customer;
  readonly paidAt?: Date;
  /** The emails about the order sent so far, so that none is sent twice. */
  readonly sentEmails: readonly OrderEmail[];
  /** 1 when created, one more with each change; each change is saved only onto the version it was made from. */
  readonly version: number;
};

/** The line amount: unit price × quantity, tax-inclusive. */
export function lineAmount(line: OrderLine): Money {
  return yen(line.unitPrice.yen * line.quantity);
}

/**
 * The consumption tax a tax-inclusive `total` includes, at 10%, once per
 * order and rounded down: floor(total × 10 / 110).
 */
export function taxIncluded(total: Money): Money {
  return yen(Math.floor((total.yen * 10) / 110));
}

/**
 * A new order, pending payment, at version 1: `lines` (none empty), with the
 * subtotal and shipping at `rates` (free from the threshold, as for the cart).
 */
export function placeOrder(order: {
  id: string;
  locale: Locale;
  lines: readonly OrderLine[];
  rates: ShippingRates;
  placedAt: Date;
  checkoutToken: string;
}): Order {
  const subtotal = yen(order.lines.reduce((sum, line) => sum + lineAmount(line).yen, 0));
  const shipping = shippingFor(subtotal, order.rates);
  return {
    id: order.id,
    status: 'pending_payment',
    locale: order.locale,
    lines: order.lines,
    subtotal,
    shipping,
    total: yen(subtotal.yen + shipping.yen),
    placedAt: order.placedAt,
    checkoutToken: order.checkoutToken,
    sentEmails: [],
    version: 1,
  };
}

/** The order once its checkout ended without a payment; undefined unless it is pending payment. */
export function expireOrder(order: Order): Order | undefined {
  return order.status === 'pending_payment' ? { ...order, status: 'expired' } : undefined;
}

/** The order once the customer paid it; undefined unless it is pending payment. */
export function payOrder(order: Order, payment: { customer: Customer; paidAt: Date }): Order | undefined {
  return order.status === 'pending_payment'
    ? { ...order, status: 'paid', customer: payment.customer, paidAt: payment.paidAt }
    : undefined;
}

/** Crockford's base32: digits and letters, without I, L, O and U, which read like 1, 1, 0 and V. */
const ORDER_NUMBER_LETTERS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Japan's offset from UTC; it has no daylight saving time. */
const JAPAN_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * A new order number: the time `now` in Japan to the second (yyyyMMddHHmmss),
 * a hyphen, and 4 random letters or digits, e.g. 20261028153012-7KQ3. Order
 * numbers sort by when the orders were placed, and are short enough to read
 * out on the phone. Two orders in the same second share the time; the
 * letters tell them apart (and adding an order whose number is taken fails).
 */
export function newOrderNumber(now: Date): string {
  const time = new Date(now.getTime() + JAPAN_OFFSET_MS).toISOString().replace(/\D/g, '').slice(0, 14);
  const letters = [...crypto.getRandomValues(new Uint8Array(4))]
    .map((byte) => ORDER_NUMBER_LETTERS[byte % ORDER_NUMBER_LETTERS.length])
    .join('');
  return `${time}-${letters}`;
}

export interface OrderRepository {
  /** The order with the number `id`; undefined if there is none. */
  byId(id: string): Promise<Order | undefined>;
  /** Adds to `unit` the write of a new order; the unit's commit is a conflict if an order already has its number. */
  addIn(unit: UnitOfWork, order: Order): void;
  /**
   * Adds to `unit` the write of `order`, changed from the stored version
   * `order.version`, as the next version; the unit's commit is a conflict if
   * the stored order is no longer at that version.
   */
  updateIn(unit: UnitOfWork, order: Order): void;
  /**
   * Stores `order`, changed from the stored version `order.version`, as the
   * next version, and returns it as stored; 'stale' (and nothing stored) if
   * the stored order is no longer at that version.
   */
  update(order: Order): Promise<Order | 'stale'>;
}
