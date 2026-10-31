import type { Locale } from './locales';

const yenDigits = new Intl.NumberFormat('ja-JP');

/** An amount of yen as the site writes it in every locale: ¥24,000. */
export function formatYen(yen: number): string {
  return `¥${yenDigits.format(yen)}`;
}

/** Each locale's language tag for dates. */
const DATE_LOCALES = { ja: 'ja-JP', zh: 'zh-CN', en: 'en-US' } satisfies Record<Locale, string>;

/**
 * A moment (ISO 8601) as the locale writes a date and time, in Japan's time
 * zone, where the store is: 2026年10月28日 15:30, October 28, 2026 at 3:30 PM.
 */
export function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(iso));
}
