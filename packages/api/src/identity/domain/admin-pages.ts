import { LOCALES, type Locale } from '../../shared-kernel/locale';

// The admin's pages are the frontend's, under each locale's prefix (ADR 0004:
// Japanese has none): /admin, /zh/admin, /en/admin and the pages below them.

const prefix = (locale: Locale) => (locale === 'ja' ? '' : `/${locale}`);

const prefixes = LOCALES.filter((locale) => locale !== 'ja').join('|');

/** An admin page's path, maybe with a query: no host, backslashes, whitespace or fragment. */
const ADMIN_PAGE = new RegExp(`^(?:/(?:${prefixes}))?/admin(?:/[^?#\\s\\\\]*)?(?:\\?[^#\\s\\\\]*)?$`);

/** A `.` or `..` segment, maybe percent-encoded, which would lead out of the admin. */
const DOT_SEGMENT = /(?:^|\/)(?:\.|%2e){1,2}(?:\/|$)/i;

/** The admin's first page in `locale`. */
export function adminHome(locale: Locale): string {
  return `${prefix(locale)}/admin`;
}

/**
 * The admin's page saying that signing in failed, in `locale`, from which the
 * owner can try again. Unlike the admin's other pages, it needs no session.
 */
export function signInFailedPage(locale: Locale): string {
  return `${adminHome(locale)}/sign-in-failed`;
}

/** Whether `path` is one of the admin's pages (in any locale), maybe with a query. */
export function isAdminPage(path: string): boolean {
  const pathname = path.split('?', 1)[0] ?? '';
  return ADMIN_PAGE.test(path) && !DOT_SEGMENT.test(pathname);
}
