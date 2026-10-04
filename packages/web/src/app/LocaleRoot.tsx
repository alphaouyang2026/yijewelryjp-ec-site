import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { loadLocaleFonts } from '../i18n/fonts';
import { htmlLang } from '../i18n/locales';
import { useLocale } from '../i18n/useLocale';

/**
 * The root of each locale's pages: keeps `<html lang>` on the URL's locale,
 * which switches the fonts (tokens.css), and loads fonts the locale needs.
 */
export function LocaleRoot() {
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = htmlLang(locale);
    loadLocaleFonts(locale);
  }, [locale]);

  return <Outlet />;
}
