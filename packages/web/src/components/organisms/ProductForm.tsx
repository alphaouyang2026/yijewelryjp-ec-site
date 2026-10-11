import { useId, useState, type FormEvent } from 'react';
import type { FieldErrors, LocalizedValues, ProductFormValues, ProductTextField, VariantValues } from '../../adminForms';
import { blankVariant } from '../../adminForms';
import type { Locale } from '../../i18n/locales';
import { useMessages } from '../../i18n/useMessages';
import { Button } from '../atoms/Button';
import { Checkbox } from '../atoms/Checkbox';
import { FieldMessage } from '../atoms/FieldMessage';
import { SelectInput } from '../atoms/SelectInput';
import { TextInput } from '../atoms/TextInput';
import { FormField } from '../molecules/FormField';
import { LocalizedTextField } from '../molecules/LocalizedTextField';
import { VariantFields } from '../molecules/VariantFields';
import styles from './ProductForm.module.css';

/**
 * The product form, for a new product (`mode` 'new': the owner enters the
 * slug) or a stored one ('edit': the slug is shown, and cannot change). It
 * holds what the owner types, and hands it to `onSubmit`; `errors` are the
 * API's field errors, shown next to each field in the owner's locale.
 */
export function ProductForm({
  mode,
  initial,
  categories,
  errors,
  submitting,
  onSubmit,
}: {
  mode: 'new' | 'edit';
  initial: ProductFormValues;
  categories: { slug: string; name: string }[];
  errors: FieldErrors;
  submitting: boolean;
  onSubmit: (values: ProductFormValues) => void;
}) {
  const messages = useMessages().admin;
  const text = messages.productForm;
  const [values, setValues] = useState(initial);
  const featuredHintId = useId();
  // Field errors name variants by position, so they no longer fit once rows are added or removed.
  const [variantsChanged, setVariantsChanged] = useState(false);

  const errorOf = (path: string) => {
    if (variantsChanged && path.startsWith('variants.')) return undefined;
    const code = errors[path];
    return code && messages.fieldErrors[code];
  };
  const localizedErrors = (path: string): Partial<Record<Locale, string>> => ({
    ja: errorOf(`${path}.ja`) ?? errorOf(path),
    zh: errorOf(`${path}.zh`),
    en: errorOf(`${path}.en`),
  });

  const textField = (field: ProductTextField, options: { required?: boolean; multiline?: boolean } = {}) => (
    <LocalizedTextField
      label={text[field]}
      value={values[field]}
      onChange={(value: LocalizedValues) => setValues({ ...values, [field]: value })}
      errors={localizedErrors(field)}
      {...options}
    />
  );

  const setVariants = (variants: VariantValues[]) => setValues({ ...values, variants });

  function submit(event: FormEvent) {
    event.preventDefault();
    setVariantsChanged(false);
    onSubmit(values);
  }

  return (
    <form noValidate onSubmit={submit} className={styles.form}>
      <section className={styles.section}>
        {mode === 'new' ? (
          <FormField label={text.slug} hint={text.slugHint} error={errorOf('slug')}>
            {(control) => (
              <TextInput
                {...control}
                autoCapitalize="off"
                spellCheck={false}
                value={values.slug}
                onChange={(event) => setValues({ ...values, slug: event.target.value })}
              />
            )}
          </FormField>
        ) : (
          <p className={styles.slug}>
            <span className={styles.slugLabel}>{text.slug}</span> <code>{values.slug}</code>
          </p>
        )}
        <p className={styles.hint}>{text.translationHint}</p>
        {textField('name', { required: true })}
        {textField('description', { required: true, multiline: true })}
      </section>

      <section className={styles.section}>
        <p className={styles.hint}>{text.detailsHint}</p>
        {textField('materials')}
        {textField('dimensions')}
        {textField('weight')}
        {textField('care', { multiline: true })}
      </section>

      <section className={styles.section}>
        <FormField label={text.category} error={errorOf('categorySlug')}>
          {(control) => (
            <SelectInput
              {...control}
              value={values.categorySlug}
              onChange={(event) => setValues({ ...values, categorySlug: event.target.value })}
            >
              <option value="">{text.noCategory}</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </SelectInput>
          )}
        </FormField>
        <div className={styles.featured}>
          <Checkbox
            checked={values.featured}
            onChange={(featured) => setValues({ ...values, featured })}
            describedBy={featuredHintId}
          >
            {text.featured}
          </Checkbox>
          <FieldMessage id={featuredHintId} tone="hint">
            {text.featuredHint}
          </FieldMessage>
        </div>
      </section>

      <fieldset className={styles.variants}>
        <legend className={styles.variantsLegend}>{text.variants}</legend>
        {errorOf('variants') && (
          <FieldMessage id="variants-error" tone="error">
            {errorOf('variants')}
          </FieldMessage>
        )}
        {values.variants.map((variant, index) => (
          <VariantFields
            key={variant.key}
            number={index + 1}
            value={variant}
            onChange={(changed) => setVariants(values.variants.map((v, i) => (i === index ? changed : v)))}
            onRemove={() => {
              setVariantsChanged(true);
              setVariants(values.variants.filter((_, i) => i !== index));
            }}
            errorOf={(path) => errorOf(`variants.${index}.${path}`)}
          />
        ))}
        <Button
          variant="secondary"
          className={styles.addVariant}
          onClick={() => {
            setVariantsChanged(true);
            setVariants([...values.variants, blankVariant()]);
          }}
        >
          {text.addVariant}
        </Button>
      </fieldset>

      <Button type="submit" variant="primary" disabled={submitting} className={styles.submit}>
        {mode === 'new' ? text.create : text.save}
      </Button>
    </form>
  );
}
