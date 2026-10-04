import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { htmlLang } from '../i18n/locales';
import { useLocale } from '../i18n/useLocale';

/** The root of each locale's pages: keeps `<html lang>` on the URL's locale. */
export function LocaleRoot() {
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = htmlLang(locale);
  }, [locale]);

  return <Outlet />;
}
