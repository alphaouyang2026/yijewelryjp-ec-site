import * as z from 'zod';
import type { GenericFieldErrorCode } from '../../interface/json-body';
import type { LineKey } from '../application/manage-cart';

// What the storefront sends to change the cart, validated field by field;
// each error message is a generic field error code (see json-body).

/** A missing value is 'required'; anything else wrong with it, 'invalid'. */
const failsWith = (issue: { input?: unknown }): GenericFieldErrorCode =>
  issue.input === undefined || issue.input === null ? 'required' : 'invalid';

/** How many of a variant: a whole number, one or more. */
const quantity = z.number({ error: failsWith }).int({ error: 'invalid' }).min(1, { error: 'invalid' });

const text = (max: number) =>
  z
    .string({ error: failsWith })
    .min(1, { error: 'required' })
    .max(max, { error: 'too_long' });

/** Adds `quantity` of the variant `sku` of the product `productSlug`. */
export const addToCartBody = z.object({ productSlug: text(80), sku: text(64), quantity }, { error: failsWith });

/** Sets the line's quantity. Removing a line is a DELETE, not a quantity of 0. */
export const cartQuantityBody = z.object({ quantity }, { error: failsWith });

// A line's id in the cart's routes: its slug and SKU, joined by a slash (slugs
// have none), in base64url. SKUs are free text, and the storefront's API
// client puts path parameters into URLs as they are, so they never go into a
// path themselves.

export function lineIdOf(line: LineKey): string {
  return Buffer.from(`${line.productSlug}/${line.sku}`, 'utf8').toString('base64url');
}

/** The line `lineId` names; undefined for an id no line could have. */
export function lineOfId(lineId: string): LineKey | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(lineId)) return undefined;
  const decoded = Buffer.from(lineId, 'base64url').toString('utf8');
  const slash = decoded.indexOf('/');
  if (slash <= 0 || slash === decoded.length - 1) return undefined;
  return { productSlug: decoded.slice(0, slash), sku: decoded.slice(slash + 1) };
}
