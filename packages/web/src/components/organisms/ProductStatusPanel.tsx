import { useId } from 'react';
import type { AdminProduct } from '../../api';
import { useMessages } from '../../i18n/useMessages';
import { Button } from '../atoms/Button';
import styles from './ProductStatusPanel.module.css';

export type StatusChange = AdminProduct['statusChanges'][number];

/**
 * A product's sales status, and a button for each status change it allows
 * (listing, unlisting, archiving, restoring). There is no deleting.
 */
export function ProductStatusPanel({
  status,
  statusChanges,
  busy,
  onChange,
}: {
  status: AdminProduct['status'];
  statusChanges: StatusChange[];
  busy: boolean;
  onChange: (change: StatusChange) => void;
}) {
  const text = useMessages().admin;
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={styles.panel}>
      <h2 id={headingId} className={styles.title}>
        {text.productActions.title}
      </h2>
      <p>
        <span className={styles.label}>{text.productActions.current}</span>{' '}
        <strong className={styles.status}>{text.productStatus[status]}</strong>
      </p>
      <div className={styles.actions}>
        {statusChanges.map((change) => (
          <Button key={change} variant={change === 'list' ? 'primary' : 'secondary'} disabled={busy} onClick={() => onChange(change)}>
            {text.productActions[change]}
          </Button>
        ))}
      </div>
    </section>
  );
}
