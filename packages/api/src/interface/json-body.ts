import { zValidator } from '@hono/zod-validator';
import type * as z from 'zod';

/**
 * Why a field of a form the admin sent was refused. The admin shows each in
 * the owner's locale next to the field it names.
 */
export const FIELD_ERROR_CODES = [
  /** Missing or blank; for a text kept per locale, its Japanese text. */
  'required',
  'too_long',
  /** Not lowercase letters and digits joined by single hyphens. */
  'invalid_slug',
  'non_negative_integer',
  /** A price above ¥99,999,999, the most a card payment in yen can be. */
  'price_too_high',
  'at_least_one_variant',
  'too_many',
  /** Another product or category already has this slug. */
  'slug_taken',
  /** Another variant, of this product or any other, already has this SKU. */
  'sku_taken',
  'unknown_category',
  /** A variant that checkouts in progress hold stock of cannot be removed. */
  'variant_has_reserved_stock',
  /** On-hand stock below what checkouts in progress hold of the variant. */
  'below_reserved_stock',
  /** Anything else wrong with the value, such as the wrong type. */
  'invalid',
] as const;

export type FieldErrorCode = (typeof FIELD_ERROR_CODES)[number];

/**
 * One field's error. `path` names the field in the request body, its parts
 * joined by dots: 'name.ja', 'variants.2.priceYen', or '' for the body itself.
 */
export type FieldError = { path: string; code: FieldErrorCode };

/** The answer (400) to a form with invalid fields: each field's first error. */
export type InvalidInput = { error: 'invalid_input'; fields: FieldError[] };

export function invalidInput(fields: FieldError[]): InvalidInput {
  const firstPerField = new Map<string, FieldError>();
  for (const field of fields) if (!firstPerField.has(field.path)) firstPerField.set(field.path, field);
  return { error: 'invalid_input', fields: [...firstPerField.values()] };
}

const isFieldErrorCode = (message: string): message is FieldErrorCode =>
  (FIELD_ERROR_CODES as readonly string[]).includes(message);

/**
 * Validates a JSON request body with `schema`, whose error messages are field
 * error codes. An invalid body gets 400 InvalidInput; a message that is not a
 * code (zod's own) counts as 'invalid'.
 */
export function jsonBody<Schema extends z.ZodType>(schema: Schema) {
  return zValidator('json', schema, (result, c) => {
    if (result.success) return;
    const fields = result.error.issues.map(
      (issue): FieldError => ({
        path: issue.path.join('.'),
        code: isFieldErrorCode(issue.message) ? issue.message : 'invalid',
      }),
    );
    return c.json(invalidInput(fields), 400);
  });
}
