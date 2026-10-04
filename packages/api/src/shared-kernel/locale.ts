/** The site's languages: Japanese (the default), Simplified Chinese and English. */
export const LOCALES = ['ja', 'zh', 'en'] as const;

export type Locale = (typeof LOCALES)[number];
