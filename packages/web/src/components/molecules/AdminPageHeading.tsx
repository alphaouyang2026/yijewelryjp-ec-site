import type { ReactNode } from 'react';
import styles from './AdminPageHeading.module.css';

/** An admin page's title, with the page's main actions (such as a link to add something) beside it. */
export function AdminPageHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.heading}>
      <h1 className={styles.title}>{title}</h1>
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}
