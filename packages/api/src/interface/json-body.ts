import { zValidator } from '@hono/zod-validator';
import type * as z from 'zod';

/**
 * Why a field of a form the admin sent was refused, for any form. The admin
 * shows each in the owner's locale next to the field it names. A module's
 * forms may add their own codes (see `jsonBody`).
 */
export const GENERIC_FIELD_ERROR_CODES = [
  /** Missing or blank; for a text kept per locale, its Japanese text. */
  'required',
  'too_long',
  'too_many',
  'non_negative_integer',
  /** Anything else wrong with the value, such as the wrong type. */
  'invalid',
] as const;

export type GenericFieldErrorCode = (typeof GENERIC_FIELD_ERROR_CODES)[number];

/**
 * One field's error. `path` names the field in the request body, its parts
 * joined by dots: 'name.ja', 'variants.2.priceYen', or '' for the body itself.
 */
export type FieldError<Code extends string> = { path: string; code: Code };

/** The answer (400) to a form with invalid fields: each field's first error. */
export type InvalidInput<Code extends string> = { error: 'invalid_input'; fields: FieldError<Code>[] };

export function invalidInput<Code extends string>(fields: FieldError<Code>[]): InvalidInput<Code> {
  const firstPerField = new Map<string, FieldError<Code>>();
  for (const field of fields) if (!firstPerField.has(field.path)) firstPerField.set(field.path, field);
  return { error: 'invalid_input', fields: [...firstPerField.values()] };
}

/**
 * Validates a JSON request body with `schema`, whose error messages are field
 * error codes: generic ones, or the module's own `codes`. An invalid body gets
 * 400 InvalidInput; a message that is neither (zod's own) counts as 'invalid'.
 */
export function jsonBody<Schema extends z.ZodType, Code extends string = never>(
  schema: Schema,
  codes: readonly Code[] = [],
) {
  const known = new Set<string>([...GENERIC_FIELD_ERROR_CODES, ...codes]);
  const isCode = (message: string): message is GenericFieldErrorCode | Code => known.has(message);
  return zValidator('json', schema, (result, c) => {
    if (result.success) return;
    const fields = result.error.issues.map(
      (issue): FieldError<GenericFieldErrorCode | Code> => ({
        path: issue.path.join('.'),
        code: isCode(issue.message) ? issue.message : 'invalid',
      }),
    );
    return c.json(invalidInput(fields), 400);
  });
}
