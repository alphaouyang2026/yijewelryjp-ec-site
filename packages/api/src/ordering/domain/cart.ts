import { yen, type Money } from '../../shared-kernel/money';

/**
 * At most this many lines: checkout reserves every line's stock in one
 * DynamoDB transaction, and its other writes must fit in it too.
 */
export const MAX_CART_LINES = 20;

/** Which variant a cart line is of: its product's slug and its SKU. */
export type LineKey = { readonly productSlug: string; readonly sku: string };

/**
 * A variant in the cart and how many of it, with the unit price the customer
 * saw when they last added it or set its quantity (the seen price).
 */
export type CartLine = LineKey & { readonly quantity: number; readonly seenPrice: Money };

/** The customer's cart: its lines in the order they were first added. */
export type Cart = { readonly lines: readonly CartLine[] };

export const EMPTY_CART: Cart = { lines: [] };

/** What shipping costs. The store settings keep the rates. */
export type ShippingRates = { readonly fee: Money; readonly freeShippingThreshold: Money };

/**
 * A line's variant as the catalog has it now: whether its product is listed,
 * and the variant's price and available stock (undefined when the product no
 * longer has the variant).
 */
export type LineInCatalog = {
  readonly listed: boolean;
  readonly variant: { readonly price: Money; readonly availableStock: number } | undefined;
};

/** Why a change to the cart was refused, as its outcome. The cart stays as it was. */
export type CartRefusal =
  | { readonly outcome: 'sold_out' }
  | { readonly outcome: 'cart_full'; readonly maxLines: number }
  | ExceedsAvailable;

/** More than can be bought: at most `availableStock`. */
export type ExceedsAvailable = { readonly outcome: 'exceeds_available'; readonly availableStock: number };

export function isSameLine(a: LineKey, b: LineKey): boolean {
  return a.productSlug === b.productSlug && a.sku === b.sku;
}

export function findLine(cart: Cart, key: LineKey): CartLine | undefined {
  return cart.lines.find((line) => isSameLine(line, key));
}

/**
 * How many of the line's variant the customer can buy now: its available
 * stock, or none when its product is not listed or no longer has the variant.
 */
function buyable(inCatalog: LineInCatalog): number {
  return inCatalog.listed && inCatalog.variant ? inCatalog.variant.availableStock : 0;
}

/** How many the cart counts of a line: its quantity, but never more than can be bought now. */
function countedQuantity(line: CartLine, inCatalog: LineInCatalog): number {
  const available = buyable(inCatalog);
  return available > 0 ? Math.min(line.quantity, available) : line.quantity;
}

/**
 * The cart with `quantity` more of a listed variant, which has `price` and
 * `availableStock` now. A variant already in the cart adds to its line, which
 * keeps its place; another goes last, as a new line. Either way the line's
 * seen price becomes the price now. Refused when the variant is sold out, when
 * a new line would exceed the most lines a cart holds, and when the line would
 * have more than the available stock (counting what it already has, as the
 * cart counts it).
 */
export function addLine(
  cart: Cart,
  key: LineKey,
  quantity: number,
  variant: { readonly price: Money; readonly availableStock: number },
): Cart | CartRefusal {
  const inCatalog: LineInCatalog = { listed: true, variant };
  if (variant.availableStock === 0) return { outcome: 'sold_out' };
  const existing = findLine(cart, key);
  if (!existing && cart.lines.length >= MAX_CART_LINES) return { outcome: 'cart_full', maxLines: MAX_CART_LINES };
  const total = (existing ? countedQuantity(existing, inCatalog) : 0) + quantity;
  if (total > variant.availableStock) return { outcome: 'exceeds_available', availableStock: variant.availableStock };

  const line: CartLine = { productSlug: key.productSlug, sku: key.sku, quantity: total, seenPrice: variant.price };
  return existing
    ? { lines: cart.lines.map((other) => (other === existing ? line : other)) }
    : { lines: [...cart.lines, line] };
}

/**
 * The cart with the line `line` set to `quantity`, its seen price now the
 * variant's price now. Refused when that is more than can be bought now: none
 * when the line's variant is sold out or no longer on sale.
 */
export function setLineQuantity(
  cart: Cart,
  line: CartLine,
  quantity: number,
  inCatalog: LineInCatalog,
): Cart | ExceedsAvailable {
  const available = buyable(inCatalog);
  if (quantity > available) return { outcome: 'exceeds_available', availableStock: available };
  const changed: CartLine = { ...line, quantity, seenPrice: inCatalog.variant?.price ?? line.seenPrice };
  return { lines: cart.lines.map((other) => (other === line ? changed : other)) };
}

/** The cart without the line of `key`; the same cart if it has no such line. */
export function removeLine(cart: Cart, key: LineKey): Cart {
  return { lines: cart.lines.filter((line) => !isSameLine(line, key)) };
}

/**
 * Something the customer should know about a line, from checking it against
 * the catalog: its product is no longer on sale (or no longer has the
 * variant), the variant is sold out, there is less of it than the line has,
 * or its price differs from the price the customer saw.
 */
export type CartNotice =
  | { readonly code: 'unlisted' }
  | { readonly code: 'sold_out' }
  | { readonly code: 'quantity_reduced'; readonly requestedQuantity: number }
  | { readonly code: 'price_changed'; readonly previousPriceYen: number };

/** A line as the catalog has it now, with what it adds to the cart's amounts. */
export type PricedLine = {
  readonly line: CartLine;
  /** The unit price now; the seen price when the product no longer has the variant. */
  readonly price: Money;
  /** The quantity the cart counts: the line's, but at most the available stock. */
  readonly quantity: number;
  /** The most the customer can have of the variant now (none when it cannot be bought). */
  readonly maxQuantity: number;
  /** Whether the line can be bought now, and so counts in the amounts. */
  readonly available: boolean;
  /** Price × quantity; zero for a line that cannot be bought. */
  readonly lineTotal: Money;
  readonly notices: readonly CartNotice[];
};

/** The cart's amounts, all tax-inclusive. */
export type PricedCart = {
  readonly lines: readonly PricedLine[];
  /** Every line's quantity, those that cannot be bought too. */
  readonly itemCount: number;
  /** The lines that can be bought: price × quantity, summed. */
  readonly subtotal: Money;
  readonly shipping: Money;
  /** Subtotal plus shipping. */
  readonly total: Money;
  readonly freeShippingThreshold: Money;
  /** How much more the subtotal needs for free shipping; zero once it has it. */
  readonly freeShippingRemaining: Money;
};

/** Each line checked against the catalog (`inCatalog`, in the same order), and the cart's amounts. */
export function priceCart(
  lines: readonly { readonly line: CartLine; readonly inCatalog: LineInCatalog }[],
  rates: ShippingRates,
): PricedCart {
  const priced = lines.map(({ line, inCatalog }) => priceLine(line, inCatalog));
  const subtotal = yen(priced.reduce((sum, line) => sum + line.lineTotal.yen, 0));
  const shipping = shippingFor(subtotal, rates);
  return {
    lines: priced,
    itemCount: priced.reduce((sum, line) => sum + line.quantity, 0),
    subtotal,
    shipping,
    total: yen(subtotal.yen + shipping.yen),
    freeShippingThreshold: rates.freeShippingThreshold,
    freeShippingRemaining: yen(Math.max(0, rates.freeShippingThreshold.yen - subtotal.yen)),
  };
}

function priceLine(line: CartLine, inCatalog: LineInCatalog): PricedLine {
  const { variant } = inCatalog;
  const price = variant?.price ?? line.seenPrice;
  const unavailable = (notice: CartNotice): PricedLine => ({
    line,
    price,
    quantity: line.quantity,
    maxQuantity: 0,
    available: false,
    lineTotal: yen(0),
    notices: [notice],
  });
  if (!inCatalog.listed || !variant) return unavailable({ code: 'unlisted' });
  if (variant.availableStock === 0) return unavailable({ code: 'sold_out' });

  const quantity = Math.min(line.quantity, variant.availableStock);
  const notices: CartNotice[] = [];
  if (quantity < line.quantity) notices.push({ code: 'quantity_reduced', requestedQuantity: line.quantity });
  if (price.yen !== line.seenPrice.yen) notices.push({ code: 'price_changed', previousPriceYen: line.seenPrice.yen });
  return {
    line,
    price,
    quantity,
    maxQuantity: variant.availableStock,
    available: true,
    lineTotal: yen(price.yen * quantity),
    notices,
  };
}

/**
 * What shipping costs for an order of `subtotal`: nothing when there is
 * nothing to ship or the subtotal reaches the free shipping threshold,
 * otherwise the shipping fee.
 */
export function shippingFor(subtotal: Money, rates: ShippingRates): Money {
  if (subtotal.yen === 0 || subtotal.yen >= rates.freeShippingThreshold.yen) return yen(0);
  return rates.fee;
}
