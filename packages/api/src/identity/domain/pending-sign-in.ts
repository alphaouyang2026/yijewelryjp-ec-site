import { randomToken } from './admin-session';

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

export function startSignIn(returnTo: string, now: Date): PendingSignIn {
  return { state: randomToken(), returnTo, startedAt: now };
}

/** Whether a callback with `state` at `now` finishes this sign-in. */
export function isFinishedBy(pending: PendingSignIn, state: string, now: Date): boolean {
  return pending.state === state && now.getTime() - pending.startedAt.getTime() < SIGN_IN_TIMEOUT_MS;
}
