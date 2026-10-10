import type { ReactNode } from 'react';
import styles from './DetailList.module.css';

/** A product's details as terms and their values, between hairlines; entries without a value are left out. */
export function DetailList({
  details,
  ground = 'light',
}: {
  details: { term: string; value: ReactNode | null }[];
  ground?: 'light' | 'dark';
}) {
  const shown = details.filter((detail) => detail.value !== null);
  if (shown.length === 0) return null;
  return (
    <dl className={[styles.list, styles[ground]].join(' ')}>
      {shown.map((detail) => (
        <div key={detail.term} className={styles.row}>
          <dt className={styles.term}>{detail.term}</dt>
          <dd className={styles.value}>{detail.value}</dd>
        </div>
      ))}
    </dl>
  );
}
