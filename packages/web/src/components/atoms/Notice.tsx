import type { ReactNode } from 'react';
import styles from './Notice.module.css';

/**
 * A message about what just happened on the page: `done` (announced politely,
 * as a status) or `problem` (announced at once, as an alert). `children` is
 * the message, maybe with an action such as a button.
 */
export function Notice({ tone, children }: { tone: 'done' | 'problem'; children: ReactNode }) {
  return (
    <div role={tone === 'problem' ? 'alert' : 'status'} className={styles[tone]}>
      {children}
    </div>
  );
}
