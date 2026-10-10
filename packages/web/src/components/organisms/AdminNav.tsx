import { useLocation } from 'react-router';
import { pathWithoutLocale } from '../../i18n/locales';
import { useMessages } from '../../i18n/useMessages';
import { ADMIN_SECTIONS, paths } from '../../paths';
import { LocalizedLink } from '../atoms/LocalizedLink';
import styles from './AdminNav.module.css';

/** The admin's sections, in order, the current one (including its sub-pages) marked as the current page. */
export function AdminNav() {
  const text = useMessages().admin;
  const { pathname } = useLocation();
  const currentPath = pathWithoutLocale({ pathname, search: '', hash: '' });

  return (
    <nav aria-label={text.nav} className={styles.nav}>
      <ul className={styles.list}>
        {ADMIN_SECTIONS.map((section) => {
          const path = paths.adminSection(section);
          const current = currentPath === path || currentPath.startsWith(`${path}/`);
          return (
            <li key={section}>
              <LocalizedLink to={path} variant="option" aria-current={current ? 'page' : undefined}>
                {text.sections[section]}
              </LocalizedLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
