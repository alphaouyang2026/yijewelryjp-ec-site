import type { SelectHTMLAttributes } from 'react';
import styles from './SelectInput.module.css';

/** A form's drop-down choice. Its options come from `children`, its label from around it. */
export function SelectInput(props: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'>) {
  return <select className={styles.select} {...props} />;
}
