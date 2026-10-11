import type { ReactNode } from 'react';
import styles from './FieldMessage.module.css';

/**
 * A line under a form field: a `hint` on how to fill it in, or an `error`
 * saying what is wrong with it. Controls point to it with aria-describedby.
 */
export function FieldMessage({ id, tone, children }: { id: string; tone: 'hint' | 'error'; children: ReactNode }) {
  return (
    <p id={id} className={styles[tone]}>
      {children}
    </p>
  );
}
