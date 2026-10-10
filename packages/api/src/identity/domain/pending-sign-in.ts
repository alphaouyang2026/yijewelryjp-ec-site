import type { Locale } from '../../shared-kernel/locale';
import { adminHome, isAdminPage } from './admin-pages';
import { randomToken } from './random-token';

/** A sign-in must come back from the identity provider within this long of starting. */
export const SIGN_IN_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * A sign-in the browser started and has not finished: the `state` the
 * identity provider must send back (so a callback the owner's browser did not
 * start is refused), and the admin page to go back to.
 */
export type PendingSignIn = {
  readonly state: string;
  readonly returnTo: string;
  readonly startedAt: Date;
};

/**
 * A sign-in started at `now`, in `locale`, to come back to the admin page
 * `returnTo`. Signing in leads only into the admin: for any other page, or
 * none, it comes back to the admin's first page in `locale`.
 */
export function startSignIn({ returnTo, locale }: { returnTo?: string; locale: Locale }, now: Date): PendingSignIn {
  return {
    state: randomToken(),
    returnTo: returnTo !== undefined && isAdminPage(returnTo) ? returnTo : adminHome(locale),
    startedAt: now,
  };
}

/** Whether a callback with `state` at `now` finishes this sign-in. */
export function isFinishedBy(pending: PendingSignIn, state: string, now: Date): boolean {
  return pending.state === state && now.getTime() - pending.startedAt.getTime() < SIGN_IN_TIMEOUT_MS;
}
