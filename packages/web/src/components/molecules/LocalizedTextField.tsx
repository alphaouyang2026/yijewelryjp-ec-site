import type { LocalizedValues } from '../../adminForms';
import { htmlLang, type Locale } from '../../i18n/locales';
import { useMessages } from '../../i18n/useMessages';
import { TextInput } from '../atoms/TextInput';
import { FormField } from './FormField';
import styles from './LocalizedTextField.module.css';

const LOCALE_ORDER: Locale[] = ['ja', 'zh', 'en'];

/**
 * A text the owner enters per locale (a product's name, a category's name…):
 * a group named `label` with a box for each locale, Japanese first, marked
 * required when `required`. `errors` holds each locale's error, if any.
 */
export function LocalizedTextField({
  label,
  value,
  onChange,
  errors = {},
  required = false,
  multiline = false,
  hint,
}: {
  label: string;
  value: LocalizedValues;
  onChange: (value: LocalizedValues) => void;
  errors?: Partial<Record<Locale, string>>;
  required?: boolean;
  multiline?: boolean;
  hint?: string;
}) {
  const text = useMessages().admin.localizedText;
  const localeLabel = { ja: required ? text.jaRequired : text.ja, zh: text.zh, en: text.en };
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{label}</legend>
      {hint && <p className={styles.hint}>{hint}</p>}
      <div className={multiline ? styles.stacked : styles.row}>
        {LOCALE_ORDER.map((locale) => (
          <FormField key={locale} label={localeLabel[locale]} error={errors[locale]}>
            {(control) => (
              <TextInput
                {...control}
                multiline={multiline}
                lang={htmlLang(locale)}
                value={value[locale]}
                onChange={(event) => onChange({ ...value, [locale]: event.target.value })}
              />
            )}
          </FormField>
        ))}
      </div>
    </fieldset>
  );
}
