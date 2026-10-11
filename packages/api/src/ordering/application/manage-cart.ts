import type { CartVariant, FindCartVariants } from '../../catalog/application/find-cart-variants';
import type { Locale } from '../../shared-kernel/locale';
import type { GetShippingRates } from '../../store/application/get-shipping-rates';
import {
  addLine,
  findLine,
  MAX_CART_LINES,
  priceCart,
  removeLine,
  setLineQuantity,
  type Cart,
  type LineInCatalog,
  type LineKey,
} from '../domain/cart';
import type { CartView } from './cart-views';

export { EMPTY_CART, MAX_CART_LINES, type Cart, type CartLine, type LineKey } from '../domain/cart';

/** What the cart use cases need of the other contexts: the catalog's variants and the store's shipping rates. */
type Deps = { findCartVariants: FindCartVariants; shippingRates: GetShippingRates };

/** Why a change to the cart changed nothing, by outcome. */
type Refusals = {
  /** No listed product has the variant. */
  not_found: object;
  sold_out: object;
  /** More than the available stock: the cart can have at most `availableStock` of the variant. */
  exceeds_available: { availableStock: number };
  /** The cart already has the most lines it can hold. */
  cart_full: { maxLines: number };
  /** The cart has no such line. */
  not_in_cart: object;
};

/**
 * How a customer's change to their cart ended: `changed`, with the cart to
 * keep and how it looks now, or one of the `Possible` refusals, when the cart
 * stays as it was. The cart to keep has no lines of products that no longer
 * exist.
 */
export type CartChange<Possible extends keyof Refusals> =
  | { outcome: 'changed'; cart: Cart; view: CartView }
  | { [R in Possible]: { outcome: R } & Refusals[R] }[Possible];

export type ViewCart = (query: { locale: Locale; cart: Cart }) => Promise<CartView>;

/** Use case: the customer's cart, each line checked against the catalog now, with its amounts. */
export function viewCart(deps: Deps): ViewCart {
  return async ({ locale, cart }) => (await checked(deps, locale, cart)).view;
}

export type AddToCart = (command: {
  locale: Locale;
  cart: Cart;
  line: LineKey;
  quantity: number;
}) => Promise<CartChange<'not_found' | 'sold_out' | 'cart_full' | 'exceeds_available'>>;

/**
 * Use case: the customer adds `quantity` of a listed product's variant to
 * their cart, to its line if the cart has one (see `addLine`).
 */
export function addToCart(deps: Deps): AddToCart {
  return async ({ locale, cart, line, quantity }) => {
    // One lookup for the cart's lines and the variant added.
    const found = await lookUp(deps, locale, [...cart.lines, line]);
    const added = found.get(keyOf(line));
    if (!added?.listed || !added.variant) return { outcome: 'not_found' };

    const changed = addLine(cart, line, quantity, added.variant);
    if ('outcome' in changed) return changed;
    return { outcome: 'changed', ...(await checked(deps, locale, changed, found)) };
  };
}

export type ChangeCartQuantity = (command: {
  locale: Locale;
  cart: Cart;
  /** Undefined for an id that names no line. */
  line: LineKey | undefined;
  quantity: number;
}) => Promise<CartChange<'not_in_cart' | 'exceeds_available'>>;

/**
 * Use case: the customer sets how many of a line's variant they want. More
 * than can be bought now is refused: none when the variant is sold out or
 * no longer on sale.
 */
export function changeCartQuantity(deps: Deps): ChangeCartQuantity {
  return async ({ locale, cart, line: key, quantity }) => {
    const line = key && findLine(cart, key);
    if (!line) return { outcome: 'not_in_cart' };
    const found = await lookUp(deps, locale, cart.lines);
    const variant = found.get(keyOf(line));
    // The cart no longer shows a line whose product no longer exists.
    if (!variant) return { outcome: 'not_in_cart' };

    const changed = setLineQuantity(cart, line, quantity, inCatalog(variant));
    if ('outcome' in changed) return changed;
    return { outcome: 'changed', ...(await checked(deps, locale, changed, found)) };
  };
}

export type RemoveFromCart = (command: {
  locale: Locale;
  cart: Cart;
  /** Undefined for an id that names no line. */
  line: LineKey | undefined;
}) => Promise<CartChange<never>>;

/** Use case: the customer removes a line from their cart. Removing a line the cart does not have changes nothing. */
export function removeFromCart(deps: Deps): RemoveFromCart {
  return async ({ locale, cart, line }) => ({
    outcome: 'changed',
    ...(await checked(deps, locale, line ? removeLine(cart, line) : cart)),
  });
}

/** The variants of the lines looked up, by line. */
type Found = ReadonlyMap<string, CartVariant | undefined>;

const keyOf = (line: LineKey) => JSON.stringify([line.productSlug, line.sku]);

/** Each of `lines`' variants as the catalog has it now; undefined for a line whose product no longer exists. */
async function lookUp(deps: Deps, locale: Locale, lines: readonly LineKey[]): Promise<Found> {
  const variants = await deps.findCartVariants({ locale, items: lines });
  return new Map(lines.map((line, index) => [keyOf(line), variants[index]]));
}

/**
 * The cart without lines of products that no longer exist, and how it looks:
 * each line checked against the catalog (`found`, if its lines were already
 * looked up), with the amounts at the store's shipping rates.
 */
async function checked(deps: Deps, locale: Locale, cart: Cart, found?: Found): Promise<{ cart: Cart; view: CartView }> {
  const [variants, rates] = await Promise.all([found ?? lookUp(deps, locale, cart.lines), deps.shippingRates()]);
  const lines = cart.lines.flatMap((line) => {
    const variant = variants.get(keyOf(line));
    return variant ? [{ line, variant }] : [];
  });
  const priced = priceCart(
    lines.map(({ line, variant }) => ({ line, inCatalog: inCatalog(variant) })),
    rates,
  );

  return {
    cart: { lines: lines.map(({ line }) => line) },
    view: {
      lines: priced.lines.map((pricedLine, index) => {
        const { variant } = lines[index]!;
        return {
          productSlug: pricedLine.line.productSlug,
          sku: pricedLine.line.sku,
          name: variant.productName,
          variantLabel: variant.variant?.label ?? null,
          photo: variant.photo,
          priceYen: pricedLine.price.yen,
          quantity: pricedLine.quantity,
          maxQuantity: pricedLine.maxQuantity,
          lineTotalYen: pricedLine.lineTotal.yen,
          available: pricedLine.available,
          notices: [...pricedLine.notices],
        };
      }),
      itemCount: priced.itemCount,
      subtotalYen: priced.subtotal.yen,
      shippingYen: priced.shipping.yen,
      totalYen: priced.total.yen,
      freeShippingThresholdYen: priced.freeShippingThreshold.yen,
      freeShippingRemainingYen: priced.freeShippingRemaining.yen,
      maxLines: MAX_CART_LINES,
    },
  };
}

function inCatalog(variant: CartVariant): LineInCatalog {
  return { listed: variant.listed, variant: variant.variant };
}
