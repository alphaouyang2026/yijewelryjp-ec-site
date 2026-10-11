import type { ChangeEvent, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import styles from './TextInput.module.css';

type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'value' | 'onChange'> & {
  /** Several lines (a text area) rather than one. */
  multiline?: boolean;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
};

/**
 * A form's text box, one line or (`multiline`) several, square with a 1px
 * line; onyx when `aria-invalid`. Its label and messages come from around it.
 */
export function TextInput({ multiline = false, ...props }: TextInputProps) {
  if (multiline) {
    return (
      <textarea className={styles.multiline} rows={4} {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
    );
  }
  return <input className={styles.input} {...props} />;
}
