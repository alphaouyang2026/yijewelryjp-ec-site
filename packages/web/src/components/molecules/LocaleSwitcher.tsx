import { useLocation } from 'react-router';
import { htmlLang, localeName, LOCALES, pathWithoutLocale } from '../../i18n/locales';
import { useLocale } from '../../i18n/useLocale';
import { useMessages } from '../../i18n/useMessages';
import { LocalizedLink } from '../atoms/LocalizedLink';
import styles from './LocaleSwitcher.module.css';

/**
 * Links to the current page, with its query and hash, in each locale. Each
 * locale is named in itself; the current one is marked as the current page.
 * `className` is for the parent's placement only.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const currentLocale = useLocale();
  const currentPage = pathWithoutLocale(useLocation());

  return (
    <nav aria-label={useMessages().localeSwitcher.nav} className={className}>
      <ul className={styles.list}>
        {LOCALES.map((locale) => (
          <li key={locale}>
            <LocalizedLink
              to={currentPage}
              locale={locale}
              lang={htmlLang(locale)}
              hrefLang={htmlLang(locale)}
              aria-current={locale === currentLocale ? 'page' : undefined}
              variant="caption"
              className={styles.link}
            >
              {localeName(locale)}
            </LocalizedLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
