import { useState, type FormEvent } from 'react';
import type { Carrier } from '../../api';
import type { FieldErrors } from '../../adminForms';
import { useMessages } from '../../i18n/useMessages';
import { Button } from '../atoms/Button';
import { SelectInput } from '../atoms/SelectInput';
import { TextInput } from '../atoms/TextInput';
import { FormField } from '../molecules/FormField';
import styles from './ShipmentForm.module.css';

/** What the shipment form holds: the carrier, its name (for 'other'), and the tracking number, as typed. */
export type ShipmentValues = { carrier: Carrier; carrierName: string; trackingNumber: string };

/** The carriers, in the form's order: those of the list, then any other. */
const CARRIERS: Carrier[] = ['yamato', 'sagawa', 'japan_post', 'other'];

/**
 * The form that marks a paid order shipped: the carrier (its name too, for
 * another one) and the tracking number. It hands what the owner typed to
 * `onSubmit`; `errors` are the API's field errors, shown by each field.
 */
export function ShipmentForm({
  errors,
  submitting,
  onSubmit,
}: {
  errors: FieldErrors;
  submitting: boolean;
  onSubmit: (values: ShipmentValues) => void;
}) {
  const messages = useMessages();
  const text = messages.admin;
  const form = text.shipmentForm;
  const [values, setValues] = useState<ShipmentValues>({ carrier: 'yamato', carrierName: '', trackingNumber: '' });
  const errorOf = (path: string) => {
    const code = errors[path];
    return code && text.fieldErrors[code];
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form noValidate onSubmit={submit} className={styles.form} aria-label={form.title}>
      <h2 className={styles.title}>{form.title}</h2>
      <FormField label={form.carrier} error={errorOf('carrier')}>
        {(control) => (
          <SelectInput
            {...control}
            value={values.carrier}
            onChange={(event) => setValues({ ...values, carrier: event.target.value as Carrier })}
          >
            {CARRIERS.map((carrier) => (
              <option key={carrier} value={carrier}>
                {messages.carriers[carrier]}
              </option>
            ))}
          </SelectInput>
        )}
      </FormField>
      {values.carrier === 'other' && (
        <FormField label={form.carrierName} error={errorOf('carrierName')}>
          {(control) => (
            <TextInput
              {...control}
              value={values.carrierName}
              onChange={(event) => setValues({ ...values, carrierName: event.target.value })}
            />
          )}
        </FormField>
      )}
      <FormField label={form.trackingNumber} error={errorOf('trackingNumber')}>
        {(control) => (
          <TextInput
            {...control}
            value={values.trackingNumber}
            onChange={(event) => setValues({ ...values, trackingNumber: event.target.value })}
          />
        )}
      </FormField>
      <Button type="submit" variant="primary" disabled={submitting} className={styles.submit}>
        {form.submit}
      </Button>
    </form>
  );
}
