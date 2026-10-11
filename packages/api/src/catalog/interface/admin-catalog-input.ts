import * as z from 'zod';
import type { FieldErrorCode } from '../../interface/json-body';
import { MAX_PRICE_YEN } from '../application/manage-products';

// What the admin's catalog forms send, validated field by field. Each error
// message is a field error code, so the admin can say what is wrong next to
// the field, in the owner's locale. Strings are trimmed first.

const SHORT_TEXT_MAX = 200;
const LONG_TEXT_MAX = 5_000;
const SLUG_MAX = 80;
const SKU_MAX = 64;
const VARIANTS_MAX = 50;

/** Lowercase letters and digits, joined by single hyphens: the product's or category's part of its URLs. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const code = (error: FieldErrorCode) => ({ error });

/** A missing value is 'required'; a value of the wrong type, 'invalid'. */
const missingOr =
  (wrongType: FieldErrorCode) =>
  (issue: { input?: unknown }): FieldErrorCode =>
    issue.input === undefined || issue.input === null ? 'required' : wrongType;

const text = (max: number) => z.string({ error: missingOr('invalid') }).trim().max(max, code('too_long'));
const requiredText = (max: number) => text(max).min(1, code('required'));
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

export const slug = requiredText(SLUG_MAX).regex(SLUG_PATTERN, code('invalid_slug'));

/** Yen or units: a whole number, zero or more. */
const count = z
  .number({ error: missingOr('non_negative_integer') })
  .int(code('non_negative_integer'))
  .min(0, code('non_negative_integer'));

const variant = z.object(
  {
    sku: requiredText(SKU_MAX),
    label: localizedText(SHORT_TEXT_MAX),
    priceYen: count.max(MAX_PRICE_YEN, code('price_too_high')),
    onHandStock: count,
  },
  { error: missingOr('invalid') },
);

/** A product's content, as both the new-product and the edit form send it. */
export const productInput = z.object({
  name: localizedText(SHORT_TEXT_MAX),
  description: localizedText(LONG_TEXT_MAX),
  materials: optionalLocalizedText(SHORT_TEXT_MAX),
  dimensions: optionalLocalizedText(SHORT_TEXT_MAX),
  weight: optionalLocalizedText(SHORT_TEXT_MAX),
  care: optionalLocalizedText(LONG_TEXT_MAX),
  /** Null: in no category. */
  categorySlug: z.string({ error: 'invalid' }).nullable(),
  featured: z.boolean({ error: 'invalid' }),
  variants: z
    .array(variant, { error: missingOr('invalid') })
    .min(1, code('at_least_one_variant'))
    .max(VARIANTS_MAX, code('too_many')),
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

/** What the edit form sends: the product's content (not its slug, which never changes) and the version it was made from. */
export const productEditBody = productInput.extend({ version });
