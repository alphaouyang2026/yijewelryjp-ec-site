import type { Locale } from '@yi/api';

export type { Locale };

type LocaleSettings = {
  /** Prefix of the locale's page paths. Japanese, the default, has none. */
  pathPrefix: string;
  /** The `<html lang>` value. Simplified Chinese is zh-Hans, so browsers pick Simplified glyphs. */
  htmlLang: string;
};

// `satisfies Record<Locale, …>` fails type checking unless every locale the API supports is listed exactly once.
const LOCALE_SETTINGS = {
  ja: { pathPrefix: '', htmlLang: 'ja' },
  zh: { pathPrefix: '/zh', htmlLang: 'zh-Hans' },
  en: { pathPrefix: '/en', htmlLang: 'en' },
} satisfies Record<Locale, LocaleSettings>;

/** The site's locales. */
export const LOCALES = Object.keys(LOCALE_SETTINGS) as Locale[];

/** The locale of unprefixed paths. */
export const DEFAULT_LOCALE: Locale = 'ja';

export function htmlLang(locale: Locale): string {
  return LOCALE_SETTINGS[locale].htmlLang;
}

/** `path` (a page path from paths.ts, maybe with a query or hash) in `locale`: '/cart' in zh is '/zh/cart', '/' is '/zh/'. */
export function localizedPath(locale: Locale, path: string): string {
  return `${LOCALE_SETTINGS[locale].pathPrefix}${path}`;
}

/** The locale a URL path is in: the one whose prefix it starts with, else the default. */
export function localeOfPath(pathname: string): Locale {
  return (
    LOCALES.find((locale) => {
      const prefix = LOCALE_SETTINGS[locale].pathPrefix;
      return prefix !== '' && (pathname === prefix || pathname.startsWith(`${prefix}/`));
    }) ?? DEFAULT_LOCALE
  );
}
