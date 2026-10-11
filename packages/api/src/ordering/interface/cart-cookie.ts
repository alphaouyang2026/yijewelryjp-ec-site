import type { Context } from 'hono';
import * as z from 'zod';
import type { SignedCookies } from '../../interface/signed-cookies';
import { yen } from '../../shared-kernel/money';
import { EMPTY_CART, MAX_CART_LINES, type Cart } from '../application/manage-cart';

/**
 * The customer's cart, which lives only in this cookie (__Host-yi_cart),
 * signed so it cannot be forged or changed; the server stores no carts.
 */
export type CartCookie = {
  /** The cart in the request's cookie; empty without one, or for a cookie the API did not issue as a cart. */
  read(c: Context): Promise<Cart>;
  /** Sets the cookie to `cart`, kept for 30 days from now; drops it when the cart is empty. */
  write(c: Context, cart: Cart): Promise<void>;
  /** Tells the browser to drop the cookie: the cart is empty again. */
  clear(c: Context): void;
  /** Whether a browser would keep the cookie with `cart` in it, which takes about 4 KB at most. */
  fits(cart: Cart): boolean;
};

/** The cart stays on the customer's device this long after it last changed. */
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Browsers keep a cookie of up to 4096 bytes (name and value); this leaves room to spare. */
const MAX_COOKIE_BYTES = 4000;

/**
 * The cookie's content: a version, and each line as [slug, SKU, quantity,
 * seen price in yen]. Short keys and tuples keep the cookie small.
 */
const content = z.object({
  v: z.literal(1),
  l: z
    .array(
      z.tuple([
        z.string().min(1).max(80),
        z.string().min(1).max(64),
        z.number().int().min(1),
        z.number().int().min(0),
      ]),
    )
    .max(MAX_CART_LINES)
    .refine((lines) => new Set(lines.map(([slug, sku]) => JSON.stringify([slug, sku]))).size === lines.length),
});

type Content = z.infer<typeof content>;

export function cartCookie(cookies: SignedCookies): CartCookie {
  const cookie = cookies.cookie('yi_cart', content);
  const toContent = (cart: Cart): Content => ({
    v: 1,
    l: cart.lines.map((line) => [line.productSlug, line.sku, line.quantity, line.seenPrice.yen]),
  });

  return {
    async read(c) {
      const stored = await cookie.read(c);
      if (!stored) return EMPTY_CART;
      return {
        lines: stored.l.map(([productSlug, sku, quantity, seenPriceYen]) => ({
          productSlug,
          sku,
          quantity,
          seenPrice: yen(seenPriceYen),
        })),
      };
    },
    async write(c, cart) {
      if (cart.lines.length === 0) cookie.clear(c);
      else await cookie.write(c, toContent(cart), MAX_AGE_SECONDS);
    },
    clear: (c) => cookie.clear(c),
    fits: (cart) => cookie.byteLength(toContent(cart)) <= MAX_COOKIE_BYTES,
  };
}
