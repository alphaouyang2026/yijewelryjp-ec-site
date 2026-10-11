import type { VariantValues } from '../../adminForms';
import { useMessages } from '../../i18n/useMessages';
import { Button } from '../atoms/Button';
import { TextInput } from '../atoms/TextInput';
import { FormField } from './FormField';
import { LocalizedTextField } from './LocalizedTextField';
import styles from './VariantFields.module.css';

/**
 * One variant's row in the product form, a group named after its `number`:
 * its name per locale, SKU, price and on-hand stock, how many checkouts hold
 * (if any), and a button to remove it. `errorOf` gives a field's error text by
 * its path within the variant ('sku', 'label.ja').
 */
export function VariantFields({
  number,
  value,
  onChange,
  onRemove,
  errorOf,
}: {
  number: number;
  value: VariantValues;
  onChange: (value: VariantValues) => void;
  onRemove: () => void;
  errorOf: (path: string) => string | undefined;
}) {
  const text = useMessages().admin.productForm;
  return (
    <fieldset className={styles.variant}>
      <legend className={styles.legend}>{text.variant(number)}</legend>
      <LocalizedTextField
        label={text.variantLabel}
        required
        value={value.label}
        onChange={(label) => onChange({ ...value, label })}
        errors={{ ja: errorOf('label.ja'), zh: errorOf('label.zh'), en: errorOf('label.en') }}
      />
      <div className={styles.numbers}>
        <FormField label={text.sku} error={errorOf('sku')}>
          {(control) => (
            <TextInput {...control} value={value.sku} onChange={(event) => onChange({ ...value, sku: event.target.value })} />
          )}
        </FormField>
        <FormField label={text.price} error={errorOf('priceYen')}>
          {(control) => (
            <TextInput
              {...control}
              type="number"
              inputMode="numeric"
              value={value.priceYen}
              onChange={(event) => onChange({ ...value, priceYen: event.target.value })}
            />
          )}
        </FormField>
        <FormField
          label={text.onHandStock}
          error={errorOf('onHandStock')}
          hint={value.reservedStock > 0 ? text.reservedStock(value.reservedStock) : undefined}
        >
          {(control) => (
            <TextInput
              {...control}
              type="number"
              inputMode="numeric"
              value={value.onHandStock}
              onChange={(event) => onChange({ ...value, onHandStock: event.target.value })}
            />
          )}
        </FormField>
      </div>
      <Button variant="secondary" onClick={onRemove} className={styles.remove}>
        {text.removeVariant(number)}
      </Button>
    </fieldset>
  );
}
