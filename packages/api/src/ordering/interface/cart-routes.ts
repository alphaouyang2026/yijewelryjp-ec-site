import { Hono, type Context } from 'hono';
import { jsonBody } from '../../interface/json-body';
import { localeQuery } from '../../interface/locale-query';
import type { CartView } from '../application/cart-views';
import {
  MAX_CART_LINES,
  type AddToCart,
  type Cart,
  type ChangeCartQuantity,
  type RemoveFromCart,
  type ViewCart,
} from '../application/manage-cart';
import { addToCartBody, cartQuantityBody, lineIdOf, lineOfId } from './cart-input';
import type { CartCookie } from './cart-cookie';

/**
 * The customer's cart, as every cart route answers with it (200): each line
 * with the id the line routes name it by.
 */
function cartResponse(view: CartView) {
  return { ...view, lines: view.lines.map((line) => ({ lineId: lineIdOf(line), ...line })) };
}

/**
 * The cart: viewing it, and adding, changing and removing its lines. Every
 * route answers in the requested locale with the whole cart (after the
 * change), checked against the catalog. Only a change sets the cookie; a
 * refused change sets nothing. No CSRF token: every change is JSON or a
 * PUT/DELETE, which other sites' pages can only send after a CORS preflight
 * the API never allows, and the cookie is SameSite=Lax.
 */
export function cartRoutes(deps: {
  viewCart: ViewCart;
  addToCart: AddToCart;
  changeCartQuantity: ChangeCartQuantity;
  removeFromCart: RemoveFromCart;
  cartCookie: CartCookie;
}) {
  const { cartCookie } = deps;

  /** Keeps the changed cart in the cookie and answers with it. */
  const changed = async (c: Context, change: { cart: Cart; view: CartView }) => {
    await cartCookie.write(c, change.cart);
    return cartResponse(change.view);
  };

  return new Hono()
    .get('/', localeQuery, async (c) => {
      const view = await deps.viewCart({ locale: c.req.valid('query').locale, cart: await cartCookie.read(c) });
      return c.json(cartResponse(view), 200);
    })
    .post('/lines', localeQuery, jsonBody(addToCartBody), async (c) => {
      const { productSlug, sku, quantity } = c.req.valid('json');
      const change = await deps.addToCart({
        locale: c.req.valid('query').locale,
        cart: await cartCookie.read(c),
        line: { productSlug, sku },
        quantity,
      });
      switch (change.outcome) {
        case 'changed':
          // A browser would drop a cookie too large to keep: the cart is as full as it can be.
          if (!cartCookie.fits(change.cart)) return c.json({ error: 'cart_full', maxLines: MAX_CART_LINES } as const, 409);
          return c.json(await changed(c, change), 200);
        case 'not_found':
          return c.json({ error: 'not_found' } as const, 404);
        case 'sold_out':
          return c.json({ error: 'sold_out' } as const, 409);
        case 'cart_full':
          return c.json({ error: 'cart_full', maxLines: change.maxLines } as const, 409);
        case 'exceeds_available':
          return c.json({ error: 'exceeds_available', availableStock: change.availableStock } as const, 409);
      }
    })
    .put('/lines/:lineId', localeQuery, jsonBody(cartQuantityBody), async (c) => {
      const change = await deps.changeCartQuantity({
        locale: c.req.valid('query').locale,
        cart: await cartCookie.read(c),
        line: lineOfId(c.req.param('lineId')),
        quantity: c.req.valid('json').quantity,
      });
      switch (change.outcome) {
        case 'changed':
          return c.json(await changed(c, change), 200);
        case 'not_in_cart':
          return c.json({ error: 'not_in_cart' } as const, 404);
        case 'exceeds_available':
          return c.json({ error: 'exceeds_available', availableStock: change.availableStock } as const, 409);
      }
    })
    .delete('/lines/:lineId', localeQuery, async (c) => {
      const change = await deps.removeFromCart({
        locale: c.req.valid('query').locale,
        cart: await cartCookie.read(c),
        line: lineOfId(c.req.param('lineId')),
      });
      return c.json(await changed(c, change), 200);
    });
}
