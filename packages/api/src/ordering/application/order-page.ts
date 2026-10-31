import type { Locale } from '../../shared-kernel/locale';
import { textIn } from '../../shared-kernel/localized-text';
import { isSameToken } from '../../shared-kernel/random-token';
import { lineAmount, taxIncluded, type OrderRepository, type OrderStatus, type ShippingAddress } from '../domain/order';

/** An order line as the order page shows it: texts in the requested locale, money as yen. */
export type OrderLineView = {
  name: string;
  variantLabel: string;
  unitPriceYen: number;
  quantity: number;
  lineAmountYen: number;
};

/** An order as the order page shows it, with its amounts (tax-inclusive) and the tax they include. */
export type OrderPageView = {
  orderNumber: string;
  status: OrderStatus;
  /** ISO 8601. */
  placedAt: string;
  lines: OrderLineView[];
  subtotalYen: number;
  shippingYen: number;
  totalYen: number;
  /** The consumption tax the total includes. */
  taxYen: number;
  /** Where it ships; null until the order is paid (the customer gives it on the payment page). */
  shippingAddress: ShippingAddress | null;
};

export type GetOrderPage = (query: { orderId: string; token: string; locale: Locale }) => Promise<OrderPageView | undefined>;

/**
 * Query: the order page, which the order confirmation links to. Only with the
 * order's checkout token, which only the customer who started the checkout
 * has; undefined for any other. Its texts are in the requested locale (the
 * page's), whatever the locale the customer ordered in.
 */
export function getOrderPage(deps: { orders: OrderRepository }): GetOrderPage {
  return async ({ orderId, token, locale }) => {
    const order = await deps.orders.byId(orderId);
    if (!order || !isSameToken(token, order.checkoutToken)) return undefined;
    return {
      orderNumber: order.id,
      status: order.status,
      placedAt: order.placedAt.toISOString(),
      lines: order.lines.map((line) => ({
        name: textIn(line.productName, locale),
        variantLabel: textIn(line.variantLabel, locale),
        unitPriceYen: line.unitPrice.yen,
        quantity: line.quantity,
        lineAmountYen: lineAmount(line).yen,
      })),
      subtotalYen: order.subtotal.yen,
      shippingYen: order.shipping.yen,
      totalYen: order.total.yen,
      taxYen: taxIncluded(order.total).yen,
      shippingAddress: order.customer?.shippingAddress ?? null,
    };
  };
}
