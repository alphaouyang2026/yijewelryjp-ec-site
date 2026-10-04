import type { Locale } from './locales';

/**
 * Google Fonts stylesheets a locale needs beyond the Japanese and Latin ones
 * index.html always loads. The Simplified Chinese stylesheet alone is about
 * as large as those, so only zh pages fetch it.
 */
const EXTRA_FONT_STYLESHEETS: Partial<Record<Locale, string>> = {
  zh: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500&family=Noto+Serif+SC:wght@400;500;600&display=swap',
};

/** Adds the locale's extra font stylesheet to the document, once. */
export function loadLocaleFonts(locale: Locale) {
  const href = EXTRA_FONT_STYLESHEETS[locale];
  if (!href || document.head.querySelector(`link[data-locale-fonts="${locale}"]`)) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.localeFonts = locale;
  document.head.append(link);
}
