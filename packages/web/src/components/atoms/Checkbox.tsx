import type { ReactNode } from 'react';
import styles from './Checkbox.module.css';

/**
 * A checkbox with its label (`children`), the whole line a tap target.
 * `describedBy` names the elements (such as a hint) that describe it.
 */
export function Checkbox({
  checked,
  onChange,
  describedBy,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  describedBy?: string;
  children: ReactNode;
}) {
  return (
    <label className={styles.checkbox}>
      <input
        type="checkbox"
        checked={checked}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}
