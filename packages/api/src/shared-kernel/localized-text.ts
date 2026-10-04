import type { Locale } from './locale';

/**
 * A piece of text kept per locale. Japanese is required; the other locales are
 * optional and fall back to the Japanese text.
 */
export type LocalizedText = Readonly<{ ja: string } & Partial<Record<Exclude<Locale, 'ja'>, string>>>;

/** The text in `locale`, or the Japanese text when that translation is missing or blank. */
export function textIn(text: LocalizedText, locale: Locale): string {
  const translation = text[locale];
  return translation?.trim() ? translation : text.ja;
}
