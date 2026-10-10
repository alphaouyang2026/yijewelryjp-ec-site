import type { Clock } from '../../shared-kernel/clock';
import type { Locale } from '../../shared-kernel/locale';
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

export type FinishSignIn = (callback: {
  code: string;
  state: string;
  pending: PendingSignIn | undefined;
}) => Promise<{ session: AdminSession; returnTo: string } | undefined>;

/**
 * Use case: the identity provider sends the browser back with a code. The
 * owner gets a new session if this browser started the sign-in (same state),
 * recently, and the provider vouches for the code; otherwise undefined.
 */
export function finishSignIn(deps: Deps): FinishSignIn {
  return async ({ code, state, pending }) => {
    if (!pending || !isFinishedBy(pending, state, deps.clock.now())) return undefined;
    const owner = await deps.adminIdentity.ownerForCode(code);
    if (!owner) return undefined;
    return { session: startSession(owner, deps.clock.now()), returnTo: pending.returnTo };
  };
}
