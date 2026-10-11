import { zValidator } from '@hono/zod-validator';
import * as z from 'zod';
import { jsonBody, type GenericFieldErrorCode } from '../../interface/json-body';
import {
  CATALOG_RULES,
  MAX_PRICE_YEN,
  OPTIONAL_PRODUCT_TEXTS,
  REQUIRED_PRODUCT_TEXTS,
  type ProductTextField,
} from '../application/manage-products';

// What the admin's catalog forms send, validated field by field. Each error
// message is a field error code, so the admin can say what is wrong next to
// the field, in the owner's locale. Strings are trimmed first.

const SHORT_TEXT_MAX = 200;
const LONG_TEXT_MAX = 5_000;
const SLUG_MAX = 80;
const SKU_MAX = 64;
const VARIANTS_MAX = 50;
/** One reorder is one DynamoDB transaction, which writes at most 100 items. */
const CATEGORIES_MAX = 100;

/** Lowercase letters and digits, joined by single hyphens: the product's or category's part of its URLs. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Why a field of an admin catalog form was refused: a generic code (see
 * json-body), one of these, or a catalog rule the input breaks.
 */
const CATALOG_FIELD_ERROR_CODES = [
  /** Not lowercase letters and digits joined by single hyphens. */
  'invalid_slug',
  'at_least_one_variant',
  /** A price above ¥99,999,999, the most a card payment in yen can be. */
  'price_too_high',
  ...CATALOG_RULES,
] as const;

type FieldErrorCode = GenericFieldErrorCode | (typeof CATALOG_FIELD_ERROR_CODES)[number];

/** Validates an admin catalog form's JSON body with `schema`: 400 with field errors if invalid. */
export const catalogJsonBody = <Schema extends z.ZodType>(schema: Schema) =>
  jsonBody(schema, CATALOG_FIELD_ERROR_CODES);

/** Zod's error option for a check that fails with field error `code`. */
const failsWith = (code: FieldErrorCode) => ({ error: code });

/** A missing value is 'required'; a value of the wrong type, 'invalid'. */
const missingOr =
  (wrongType: FieldErrorCode) =>
  (issue: { input?: unknown }): FieldErrorCode =>
    issue.input === undefined || issue.input === null ? 'required' : wrongType;

const text = (max: number) => z.string({ error: missingOr('invalid') }).trim().max(max, failsWith('too_long'));
const requiredText = (max: number) => text(max).min(1, failsWith('required'));
/** A translation: blank means not entered, and then the Japanese text is shown. */
const translation = (max: number) =>
  text(max)
    .optional()
    .transform((value) => value || undefined);

/** A text kept per locale: Japanese required, Chinese and English optional. */
const localizedText = (max: number) =>
  z.object({ ja: requiredText(max), zh: translation(max), en: translation(max) }, { error: missingOr('invalid') });

/**
 * A detail the owner may leave out (materials, size, …): left out when every
 * locale is blank (or it is missing or null); otherwise its Japanese text is required.
 */
const optionalLocalizedText = (max: number) =>
  z
    .object({ ja: translation(max), zh: translation(max), en: translation(max) }, { error: missingOr('invalid') })
    .nullish()
    .superRefine((value, context) => {
      if (value && !value.ja && (value.zh || value.en)) {
        context.addIssue({ code: 'custom', path: ['ja'], message: 'required' });
      }
    })
    .transform((value) => (value?.ja ? { ja: value.ja, zh: value.zh, en: value.en } : undefined));

export const slug = requiredText(SLUG_MAX).regex(SLUG_PATTERN, failsWith('invalid_slug'));

/**
 * The `:slug` of a product's or category's path. Anything that cannot be a
 * slug names nothing there is: 404, as for a slug no product or category has.
 */
export const slugParam = zValidator('param', z.object({ slug }), (result, c) => {
  if (!result.success) return c.json({ error: 'not_found' } as const, 404);
});

/** Yen or units: a whole number, zero or more. */
const nonNegativeInteger = z
  .number({ error: missingOr('non_negative_integer') })
  .int(failsWith('non_negative_integer'))
  .min(0, failsWith('non_negative_integer'));

const variant = z.object(
  {
    sku: requiredText(SKU_MAX),
    label: localizedText(SHORT_TEXT_MAX),
    priceYen: nonNegativeInteger.max(MAX_PRICE_YEN, failsWith('price_too_high')),
    onHandStock: nonNegativeInteger,
  },
  { error: missingOr('invalid') },
);

/** How long each of a product's texts may be: a line, or paragraphs. */
const PRODUCT_TEXT_MAX: Record<ProductTextField, number> = {
  name: SHORT_TEXT_MAX,
  description: LONG_TEXT_MAX,
  materials: SHORT_TEXT_MAX,
  dimensions: SHORT_TEXT_MAX,
  weight: SHORT_TEXT_MAX,
  care: LONG_TEXT_MAX,
};

/** A Zod shape with a schema for each of `fields`. */
function shapeOf<Field extends string, Schema extends z.ZodType>(
  fields: readonly Field[],
  schemaOf: (field: Field) => Schema,
): Record<Field, Schema> {
  return Object.fromEntries(fields.map((field) => [field, schemaOf(field)])) as Record<Field, Schema>;
}

/** A product's content, as both the new-product and the edit form send it. */
export const productInput = z.object({
  ...shapeOf(REQUIRED_PRODUCT_TEXTS, (field) => localizedText(PRODUCT_TEXT_MAX[field])),
  ...shapeOf(OPTIONAL_PRODUCT_TEXTS, (field) => optionalLocalizedText(PRODUCT_TEXT_MAX[field])),
  /** Null: in no category. */
  categorySlug: z.string({ error: 'invalid' }).nullable(),
  featured: z.boolean({ error: 'invalid' }),
  variants: z
    .array(variant, { error: missingOr('invalid') })
    .min(1, failsWith('at_least_one_variant'))
    .max(VARIANTS_MAX, failsWith('too_many')),
});

export const newProductBody = productInput.extend({ slug });

/** A category's name: Japanese required, Chinese and English optional. */
export const categoryName = localizedText(SHORT_TEXT_MAX);

/**
 * The version of the product or category the owner's change was made from:
 * 0 for one stored before products and categories had versions.
 */
export const version = z.number({ error: 'invalid' }).int({ error: 'invalid' }).min(0, { error: 'invalid' });

export const versionBody = z.object({ version });

/** A product or category as the owner saw it: its slug, and the version it was at. */
const versionedSlug = z.object({ slug, version });

/** The categories' new order: each category once, with the version the owner saw. */
export const categoryOrderBody = z.object({
  categories: z
    .array(versionedSlug, { error: missingOr('invalid') })
    .max(CATEGORIES_MAX, failsWith('too_many'))
    .refine((order) => new Set(order.map((entry) => entry.slug)).size === order.length, { error: 'invalid' }),
});

/** What the edit form sends: the product's content (not its slug, which never changes) and the version it was made from. */
export const productEditBody = productInput.extend({ version });
