import type { Clock } from '../../shared-kernel/clock';
import type { Locale } from '../../shared-kernel/locale';
import { signInFailedPage } from '../domain/admin-pages';
import type { AdminIdentity } from '../domain/admin-identity';
import { startSession, type AdminSession } from '../domain/admin-session';
import { isFinishedBy, SIGN_IN_TIMEOUT_MS, startSignIn, type PendingSignIn } from '../domain/pending-sign-in';

export type { PendingSignIn };
export { SIGN_IN_TIMEOUT_MS };

type Deps = { adminIdentity: AdminIdentity; clock: Clock };

export type BeginSignIn = (request: { locale: Locale; returnTo?: string }) => {
  /** Where the browser goes to sign in. */
  signInUrl: string;
  /** What the browser keeps until it comes back to the callback. */
  pending: PendingSignIn;
};

/**
 * Use case: an owner starts signing in, in `locale`, to come back to the admin
 * page `returnTo` (or the admin's first page, if it is not an admin page).
 */
export function beginSignIn(deps: Deps): BeginSignIn {
  return ({ locale, returnTo }) => {
    const pending = startSignIn({ returnTo, locale }, deps.clock.now());
    return { signInUrl: deps.adminIdentity.signInUrl({ state: pending.state, locale }), pending };
  };
}

/** How a sign-in ended: signed in, with the page to go back to; or not, with the page that says so. */
export type SignInResult =
  | { signedIn: true; session: AdminSession; returnTo: string }
  | { signedIn: false; failedPage: string };

export type FinishSignIn = (callback: {
  /** The provider's authorization code; undefined when it reported an error instead (e.g. the owner cancelled). */
  code: string | undefined;
  state: string | undefined;
  pending: PendingSignIn | undefined;
}) => Promise<SignInResult>;

// Without a sign-in in progress, the sign-in's locale is unknown: the default one.
const DEFAULT_LOCALE: Locale = 'ja';

/**
 * Use case: the identity provider sends the browser back. The owner gets a new
 * session if this browser started the sign-in (same state), recently, and the
 * provider vouches for the code; otherwise the browser goes to the page saying
 * that signing in failed, in the sign-in's locale.
 */
export function finishSignIn(deps: Deps): FinishSignIn {
  return async ({ code, state, pending }) => {
    const failed = { signedIn: false, failedPage: signInFailedPage(pending?.locale ?? DEFAULT_LOCALE) } as const;
    const now = deps.clock.now();
    if (!pending || code === undefined || state === undefined || !isFinishedBy(pending, state, now)) return failed;
    const owner = await deps.adminIdentity.ownerForCode(code);
    if (!owner) return failed;
    return { signedIn: true, session: startSession(owner, now), returnTo: pending.returnTo };
  };
}
