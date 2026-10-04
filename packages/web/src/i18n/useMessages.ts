import type { Locale } from './locales';
import { en } from './messages/en';
import { ja, type Messages } from './messages/ja';
import { zh } from './messages/zh';
import { useLocale } from './useLocale';

const messages: Record<Locale, Messages> = { ja, zh, en };

/** The interface text in the current page's locale. */
export function useMessages(): Messages {
  return messages[useLocale()];
}
