import { useId, type ReactNode } from 'react';
import { FieldMessage } from '../atoms/FieldMessage';
import styles from './FormField.module.css';

/** What a field's control needs to be labelled and described: pass it on to the control. */
export type FieldControlProps = { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true };

/**
 * One form field: its label, the control (`children` renders it from the
 * props it is given), and under it the field's error (if any) and hint (if
 * any), which describe the control.
 */
export function FormField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (control: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ');
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children({
        id,
        ...(describedBy && { 'aria-describedby': describedBy }),
        ...(error && { 'aria-invalid': true }),
      })}
      {error && (
        <FieldMessage id={errorId} tone="error">
          {error}
        </FieldMessage>
      )}
      {hint && (
        <FieldMessage id={hintId} tone="hint">
          {hint}
        </FieldMessage>
      )}
    </div>
  );
}
