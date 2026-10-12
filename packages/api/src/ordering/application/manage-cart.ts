import type { CartVariant, FindCartVariants } from '../../catalog/application/find-cart-variants';
import type { Locale } from '../../shared-kernel/locale';
import type { GetShippingRates } from '../../store/application/get-shipping-rates';
import {
  addLine,
  findLine,
  lineKeyString,
  priceCart,
  removeLine,
  setLineQuantity,
  type Cart,
  type CartRefusal,
  type ExceedsAvailable,
  type LineInCatalog,
  type LineKey,
} from '../domain/cart';
import type { CartView } from './cart-views';

export { EMPTY_CART, lineKeyString, MAX_CART_LINES, type Cart, type CartLine, type LineKey } from '../domain/cart';

/** What the cart use cases need of the other contexts: the catalog's variants and the store's shipping rates. */
type Deps = { findCartVariants: FindCartVariants; shippingRates: GetShippingRates };

/**
 * The cart checked against the catalog: the cart to keep, which has no lines
 * of products that no longer exist, and how it looks now.
 */
export type CheckedCart = { cart: Cart; view: CartView };

/**
 * How a customer's change to their cart ended: `changed`, with the changed
 * cart checked against the catalog, or one of the `Refusal`s, when the cart
 * stays as it was.
 */
export type CartChange<Refusal> = ({ outcome: 'changed' } & CheckedCart) | Refusal;

/** Refused: no listed product has the variant. */
type NotFound = { outcome: 'not_found' };

/** Refused: the cart has no such line. */
type NotInCart = { outcome: 'not_in_cart' };

export type ViewCart = (query: { locale: Locale; cart: Cart }) => Promise<CartView>;

/** Use case: the customer's cart, each line checked against the catalog now, with its amounts. */
export function viewCart(deps: Deps): ViewCart {
  return async ({ locale, cart }) => (await checkAgainstCatalog(deps, locale, cart)).view;
}

export type AddToCart = (command: {
  locale: Locale;
  cart: Cart;
  line: LineKey;
  quantity: number;
}) => Promise<CartChange<NotFound | CartRefusal>>;

/**
 * Use case: the customer adds `quantity` of a listed product's variant to
 * their cart, to its line if the cart has one (see `addLine`).
 */
export function addToCart(deps: Deps): AddToCart {
  return async ({ locale, cart, line, quantity }) => {
    // One lookup for the cart's lines and the variant added.
    const variants = await lookUp(deps, locale, [...cart.lines, line]);
    const added = variants.get(lineKeyString(line));
    if (!added?.listed || !added.variant) return { outcome: 'not_found' };

    const changed = addLine(cart, line, quantity, added.variant);
    if ('outcome' in changed) return changed;
    return { outcome: 'changed', ...(await checkAgainstCatalog(deps, locale, changed, variants)) };
  };
}

export type ChangeCartQuantity = (command: {
  locale: Locale;
  cart: Cart;
  /** Undefined for an id that names no line. */
  line: LineKey | undefined;
  quantity: number;
}) => Promise<CartChange<NotInCart | ExceedsAvailable>>;

/**
 * Use case: the customer sets how many of a line's variant they want. More
 * than can be bought now is refused: none when the variant is sold out or
 * no longer on sale.
 */
export function changeCartQuantity(deps: Deps): ChangeCartQuantity {
  return async ({ locale, cart, line: key, quantity }) => {
    const line = key && findLine(cart, key);
    if (!line) return { outcome: 'not_in_cart' };
    const variants = await lookUp(deps, locale, cart.lines);
    const variant = variants.get(lineKeyString(line));
    // The cart no longer shows a line whose product no longer exists.
    if (!variant) return { outcome: 'not_in_cart' };

    const changed = setLineQuantity(cart, line, quantity, inCatalog(variant));
    if ('outcome' in changed) return changed;
    return { outcome: 'changed', ...(await checkAgainstCatalog(deps, locale, changed, variants)) };
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
    ...(await checkAgainstCatalog(deps, locale, line ? removeLine(cart, line) : cart)),
  });
}

/**
 * Lines' variants as the catalog has them now, by line (`lineKeyString`);
 * undefined for a line whose product no longer exists.
 */
type VariantsByLine = ReadonlyMap<string, CartVariant | undefined>;

/** Each of `lines`' variants as the catalog has it now. */
async function lookUp(deps: Deps, locale: Locale, lines: readonly LineKey[]): Promise<VariantsByLine> {
  const variants = await deps.findCartVariants({ locale, variants: lines });
  return new Map(lines.map((line, index) => [lineKeyString(line), variants[index]]));
}

/**
 * The cart checked against the catalog: each line against its variant now
 * (from `lookedUp`, when the lines were already looked up), with the amounts
 * at the store's shipping rates.
 */
async function checkAgainstCatalog(
  deps: Deps,
  locale: Locale,
  cart: Cart,
  lookedUp?: VariantsByLine,
): Promise<CheckedCart> {
  const [variants, rates] = await Promise.all([lookedUp ?? lookUp(deps, locale, cart.lines), deps.shippingRates()]);
  const lines = cart.lines.flatMap((line) => {
    const variant = variants.get(lineKeyString(line));
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
          lineAmountYen: pricedLine.lineAmount.yen,
          available: pricedLine.available,
          notices: [...pricedLine.notices],
        };
      }),
      quantity: priced.quantity,
      subtotalYen: priced.subtotal.yen,
      shippingYen: priced.shipping.yen,
      totalYen: priced.total.yen,
      freeShippingThresholdYen: priced.freeShippingThreshold.yen,
      freeShippingRemainingYen: priced.freeShippingRemaining.yen,
    },
  };
}

function inCatalog(variant: CartVariant): LineInCatalog {
  return { listed: variant.listed, variant: variant.variant };
}
