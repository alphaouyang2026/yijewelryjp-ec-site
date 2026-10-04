import { useLocation } from 'react-router';
import { localeOfPath, type Locale } from './locales';

/** The current page's locale, which its URL decides. */
export function useLocale(): Locale {
  return localeOfPath(useLocation().pathname);
}
