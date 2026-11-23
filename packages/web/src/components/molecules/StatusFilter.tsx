import type { PagePath } from '../../paths';
import { LocalizedLink } from '../atoms/LocalizedLink';
import styles from './StatusFilter.module.css';

/** One of a status filter's links: where it goes, and whether the page shows it now. */
export type StatusFilterOption = { label: string; to: PagePath; current: boolean };

/** Links to an admin list with one status's items (or its default); the current one is marked. */
export function StatusFilter({ label, options }: { label: string; options: StatusFilterOption[] }) {
  return (
    <nav aria-label={label} className={styles.filter}>
      {options.map((option) => (
        <LocalizedLink
          key={option.label}
          to={option.to}
          variant="option"
          aria-current={option.current ? 'page' : undefined}
        >
          {option.label}
        </LocalizedLink>
      ))}
    </nav>
  );
}
