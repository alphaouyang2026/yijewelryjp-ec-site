import type { ProductTextField } from '@yi/api';
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

/** Whether two texts, as forms edit them, are the same in every locale. */
export const sameText = (a: LocalizedValues, b: LocalizedValues): boolean => a.ja === b.ja && a.zh === b.zh && a.en === b.en;

/**
 * A product's texts, each kept per locale, in the API's order: a Record, so
 * type checking fails if it leaves out a text the API has.
 */
const PRODUCT_TEXTS: Record<ProductTextField, true> = {
  name: true,
  description: true,
  materials: true,
  dimensions: true,
  weight: true,
  care: true,
};

export type { ProductTextField };

/** A product's texts as the form edits them. */
type ProductTextValues = Record<ProductTextField, LocalizedValues>;

/** Each of a product's texts, made by `valueOf`. */
function productTextValues(valueOf: (field: ProductTextField) => LocalizedValues): ProductTextValues {
  const fields = Object.keys(PRODUCT_TEXTS) as ProductTextField[];
  return Object.fromEntries(fields.map((field) => [field, valueOf(field)])) as ProductTextValues;
}

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

/** A photo of the product, uploaded: its key, the URL it is served at (for the preview), and its alt text. */
export type PhotoValues = { key: string; url: string; alt: LocalizedValues };

export type ProductFormValues = ProductTextValues & {
  slug: string;
  /** '' for no category. */
  categorySlug: string;
  featured: boolean;
  variants: VariantValues[];
  /** In the owner's order: the first is the one lists and the home page show. */
  photos: PhotoValues[];
};

/**
 * How uploading a photo the owner picked ended: the photo, ready for its alt
 * text, or why it was not uploaded: the API's reason (a type other than
 * JPEG, PNG or WebP, or over 5 MB), or 'failed' for anything else.
 */
export type PhotoUploadResult = { photo: PhotoValues } | { problem: FieldErrorCode | 'failed' };

let lastVariantKey = 0;

export function blankVariant(): VariantValues {
  lastVariantKey += 1;
  return { key: `new-${lastVariantKey}`, sku: '', label: blankText(), priceYen: '', onHandStock: '', reservedStock: 0 };
}

/** A new product's form: everything blank, with one variant to fill in. */
export function blankProduct(): ProductFormValues {
  return {
    slug: '',
    ...productTextValues(blankText),
    categorySlug: '',
    featured: false,
    variants: [blankVariant()],
    photos: [],
  };
}

/** A stored product's form. */
export function productValues(product: AdminProduct): ProductFormValues {
  return {
    slug: product.slug,
    ...productTextValues((field) => textValues(product[field])),
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
    photos: product.photos.map((photo) => ({ key: photo.key, url: photo.url, alt: textValues(photo.alt) })),
  };
}

/**
 * A number as the owner typed it. A blank or non-numeric one becomes NaN, which JSON sends as
 * null, and the API answers 'required' or 'non_negative_integer' for it.
 */
const numberAsTyped = (typed: string) => (typed.trim() === '' ? Number.NaN : Number(typed));

/** The product's content as the API takes it, for creating (with the slug) or editing it. */
export function productContent(values: ProductFormValues): Omit<NewProduct, 'slug'> {
  return {
    ...productTextValues((field) => values[field]),
    categorySlug: values.categorySlug === '' ? null : values.categorySlug,
    featured: values.featured,
    variants: values.variants.map((variant) => ({
      sku: variant.sku,
      label: variant.label,
      priceYen: numberAsTyped(variant.priceYen),
      onHandStock: numberAsTyped(variant.onHandStock),
    })),
    photos: values.photos.map((photo) => ({ key: photo.key, alt: photo.alt })),
  };
}
