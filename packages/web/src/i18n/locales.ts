import type { Locale } from '@yi/api';
import type { PagePath } from '../paths';

export type { Locale };

type LocaleSettings = {
  /** Prefix of the locale's page paths. Japanese, the default, has none. */
  pathPrefix: string;
  /** The `<html lang>` value. Simplified Chinese is zh-Hans, so browsers pick Simplified glyphs. */
  htmlLang: string;
  /**
   * The locale's name in itself, for the locale switcher. It stays here, not in
   * the translation resources, because it is the same in every locale: visitors
   * look for their language by its own name.
   */
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

/** The page path `path` in `locale`: '/cart' in zh is '/zh/cart', '/' is '/zh/'. */
export function localizedPath(locale: Locale, path: PagePath): string {
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

/**
 * The page a URL shows, as a page path: its path without the locale prefix,
 * then its query and hash. '/zh/cart?step=2' is '/cart?step=2', '/zh/' is '/'.
 */
export function pathWithoutLocale({
  pathname,
  search,
  hash,
}: Pick<Location, 'pathname' | 'search' | 'hash'>): PagePath {
  const path = pathname.slice(LOCALE_SETTINGS[localeOfPath(pathname)].pathPrefix.length) || '/';
  return `${path}${search}${hash}` as PagePath;
}
