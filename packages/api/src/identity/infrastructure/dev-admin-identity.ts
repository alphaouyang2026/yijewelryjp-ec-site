import type { AdminIdentity } from '../domain/admin-identity';
import type { Owner } from '../domain/owner';
import type { AdminReturnUrls } from './admin-urls';

const DEV_CODE = 'local-development';

/**
 * Local development only (src/local.ts; ESLint keeps it out of everything
 * else): signing in succeeds at once as `owner`, without Cognito. The sign-in
 * "page" is the API's own callback with a fixed code, and signing out goes
 * straight to the store's home page. The rest of the sign-in (state check,
 * session cookie, idle expiry, CSRF) is the production code.
 */
export function devAdminIdentity({ owner, returnUrls }: { owner: Owner; returnUrls: AdminReturnUrls }): AdminIdentity {
  return {
    signInUrl: ({ state }) => `${returnUrls.callbackUrl}?${new URLSearchParams({ code: DEV_CODE, state })}`,
    ownerForCode: async (code) => (code === DEV_CODE ? owner : undefined),
    signOutUrl: (locale) => returnUrls.signedOutUrl(locale),
  };
}
