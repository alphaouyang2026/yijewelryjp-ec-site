import type { Locale } from '@yi/api';

export type { Locale };

type LocaleSettings = {
  /** Prefix of the locale's page paths. Japanese, the default, has none. */
  pathPrefix: string;
  /** The `<html lang>` value. Simplified Chinese is zh-Hans, so browsers pick Simplified glyphs. */
  htmlLang: string;
  /** The locale's name in itself, the same in every locale, for the locale switcher. */
  name: string;
};

// `satisfies Record<Locale, …>` fails type checking unless every locale the API supports is listed exactly once.
const LOCALE_SETTINGS = {
  ja: { pathPrefix: '', htmlLang: 'ja', name: '日本語' },
  zh: { pathPrefix: '/zh', htmlLang: 'zh-Hans', name: '中文' },
  en: { pathPrefix: '/en', htmlLang: 'en', name: 'English' },
} satisfies Record<Locale, LocaleSettings>;

/** The site's locales, in the locale switcher's order. */
export const LOCALES = Object.keys(LOCALE_SETTINGS) as Locale[];

/** The locale of unprefixed paths. */
export const DEFAULT_LOCALE: Locale = 'ja';

export function htmlLang(locale: Locale): string {
  return LOCALE_SETTINGS[locale].htmlLang;
}

export function localeName(locale: Locale): string {
  return LOCALE_SETTINGS[locale].name;
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

/** A URL path without its locale prefix, as paths.ts writes it: '/zh/cart' is '/cart', '/zh/' is '/'. */
export function pathWithoutLocale(pathname: string): string {
  return pathname.slice(LOCALE_SETTINGS[localeOfPath(pathname)].pathPrefix.length) || '/';
}
