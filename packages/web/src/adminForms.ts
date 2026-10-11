import type { AdminProduct, FieldErrorCode, InvalidInput, NewProduct } from './api';
import type { Locale } from './i18n/locales';

// The admin's forms: what their fields hold, and how that turns into the
// API's request bodies and back. The API validates everything; the forms send
// what the owner typed and show the field errors the API returns.

/** A text kept per locale, as a form edits it: blank where not entered. */
export type LocalizedValues = Record<Locale, string>;

/** Each field's error code from the API's 400 answer, by the field's path in the request body ('name.ja'). */
export type FieldErrors = Partial<Record<string, FieldErrorCode>>;

export function fieldErrorsOf(invalid: InvalidInput): FieldErrors {
  return Object.fromEntries(invalid.fields.map(({ path, code }) => [path, code]));
}

export const blankText = (): LocalizedValues => ({ ja: '', zh: '', en: '' });

/** A stored text, every locale filled in or blank. */
export const textValues = (text: Partial<LocalizedValues> | null): LocalizedValues => ({
  ja: text?.ja ?? '',
  zh: text?.zh ?? '',
  en: text?.en ?? '',
});

export type VariantValues = {
  /** Tells the form's rows apart while the owner adds and removes them. */
  key: string;
  sku: string;
  label: LocalizedValues;
  /** As typed; the API checks it is a whole number of zero or more. */
  priceYen: string;
  onHandStock: string;
  /** How many checkouts hold, shown but not edited. */
  reservedStock: number;
};

export type ProductFormValues = {
  slug: string;
  name: LocalizedValues;
  description: LocalizedValues;
  materials: LocalizedValues;
  dimensions: LocalizedValues;
  weight: LocalizedValues;
  care: LocalizedValues;
  /** '' for no category. */
  categorySlug: string;
  featured: boolean;
  variants: VariantValues[];
};

let lastVariantKey = 0;

export function blankVariant(): VariantValues {
  lastVariantKey += 1;
  return { key: `new-${lastVariantKey}`, sku: '', label: blankText(), priceYen: '', onHandStock: '', reservedStock: 0 };
}

/** A new product's form: everything blank, with one variant to fill in. */
export function blankProduct(): ProductFormValues {
  return {
    slug: '',
    name: blankText(),
    description: blankText(),
    materials: blankText(),
    dimensions: blankText(),
    weight: blankText(),
    care: blankText(),
    categorySlug: '',
    featured: false,
    variants: [blankVariant()],
  };
}

/** A stored product's form. */
export function productValues(product: AdminProduct): ProductFormValues {
  return {
    slug: product.slug,
    name: textValues(product.name),
    description: textValues(product.description),
    materials: textValues(product.materials),
    dimensions: textValues(product.dimensions),
    weight: textValues(product.weight),
    care: textValues(product.care),
    categorySlug: product.categorySlug ?? '',
    featured: product.featured,
    variants: product.variants.map((variant) => ({
      key: variant.sku,
      sku: variant.sku,
      label: textValues(variant.label),
      priceYen: String(variant.priceYen),
      onHandStock: String(variant.onHandStock),
      reservedStock: variant.reservedStock,
    })),
  };
}

/**
 * A count as typed. A blank or non-numeric one becomes NaN, which JSON sends as
 * null, and the API answers 'required' or 'non_negative_integer' for it.
 */
const count = (typed: string) => (typed.trim() === '' ? Number.NaN : Number(typed));

/** The product's content as the API takes it, for creating (with the slug) or editing it. */
export function productContent(values: ProductFormValues): Omit<NewProduct, 'slug'> {
  return {
    name: values.name,
    description: values.description,
    materials: values.materials,
    dimensions: values.dimensions,
    weight: values.weight,
    care: values.care,
    categorySlug: values.categorySlug === '' ? null : values.categorySlug,
    featured: values.featured,
    variants: values.variants.map((variant) => ({
      sku: variant.sku,
      label: variant.label,
      priceYen: count(variant.priceYen),
      onHandStock: count(variant.onHandStock),
    })),
  };
}
