import type { Owner } from './owner';
import { randomToken } from './random-token';

/** An owner's session goes after this long without a request to the admin. */
export const SESSION_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/**
 * An owner's session goes this long after signing in, however active the
 * owner is. The API asks the identity provider about the owner only when they
 * sign in, so this bounds how long an owner disabled there keeps access.
 */
export const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;

/**
 * A signed-in owner's session. The API keeps it in a signed cookie, not in the
 * table, so it holds everything a request needs: who signed in and when, the
 * CSRF token the admin's state-changing requests must send, and when the owner
 * was last active.
 */
export type AdminSession = {
  readonly owner: Owner;
  readonly csrfToken: string;
  readonly signedInAt: Date;
  readonly lastActiveAt: Date;
};

/** A new session for `owner`, signed in and active as of `now`. */
export function startSession(owner: Owner, now: Date): AdminSession {
  return { owner, csrfToken: randomToken(), signedInAt: now, lastActiveAt: now };
}

/**
 * When the session ends unless the owner is active again before then: after
 * the idle timeout, or at the end of its lifetime, whichever comes first.
 */
export function expiresAt(session: AdminSession): Date {
  return new Date(
    Math.min(
      session.lastActiveAt.getTime() + SESSION_IDLE_TIMEOUT_MS,
      session.signedInAt.getTime() + SESSION_LIFETIME_MS,
    ),
  );
}

/**
 * Whether the session has ended by `now`: it went idle too long, or it was
 * signed in too long ago. A session without valid times has ended too.
 */
export function isExpired(session: AdminSession, now: Date): boolean {
  const left = expiresAt(session).getTime() - now.getTime();
  return !Number.isFinite(left) || left <= 0;
}

/** The session after a request at `now`: idle expiry slides forward, up to the end of its lifetime. */
export function touch(session: AdminSession, now: Date): AdminSession {
  return { ...session, lastActiveAt: now };
}
