import type { ReactNode } from 'react';
import styles from './Label.module.css';

/**
 * An English label (spec: Cormorant Garamond, 14px, 0.34em tracking, all caps)
 * in brand gold on dark grounds or deep gold on light ones. `className` is for
 * the parent's spacing only.
 */
export function Label({ children, ground, className }: { children: ReactNode; ground: 'dark' | 'light'; className?: string }) {
  return <p className={[styles.label, styles[ground], className].filter(Boolean).join(' ')}>{children}</p>;
}
