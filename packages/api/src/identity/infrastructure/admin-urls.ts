import type { Locale } from '../../shared-kernel/locale';

/**
 * Where the identity provider sends the browser back to, as both adapters
 * need them. The Cognito app client must allow exactly these URLs on the
 * site's domain (packages/infra registers them).
 */
export type AdminReturnUrls = {
  /** The API's sign-in callback (GET /api/admin/auth/callback). */
  callbackUrl: string;
  /** The store's home page in `locale`, where the browser lands after signing out. */
  signedOutUrl(locale: Locale): string;
};

/** The return URLs on the site at `siteUrl` ('' for URLs relative to the site's own origin). */
export function adminReturnUrls(siteUrl: string): AdminReturnUrls {
  return {
    callbackUrl: `${siteUrl}/api/admin/auth/callback`,
    // The frontend's home page per locale (ADR 0004): '/', '/zh/', '/en/'.
    signedOutUrl: (locale) => `${siteUrl}${locale === 'ja' ? '/' : `/${locale}/`}`,
  };
}
