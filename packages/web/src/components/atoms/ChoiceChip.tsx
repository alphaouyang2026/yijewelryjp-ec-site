import type { ReactNode } from 'react';
import styles from './ChoiceChip.module.css';

/**
 * One choice of a group (a radio button), drawn as a chip: chosen ones get a
 * double onyx line, unavailable ones are struck through and cannot be chosen.
 * `children` is the choice's text, which also names it.
 */
export function ChoiceChip({
  name,
  value,
  checked,
  disabled,
  onChoose,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled: boolean;
  onChoose: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className={styles.chip}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChoose(value)}
        className={styles.input}
      />
      <span className={styles.face}>{children}</span>
    </label>
  );
}
