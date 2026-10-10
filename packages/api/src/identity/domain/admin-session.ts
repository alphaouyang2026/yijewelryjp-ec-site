import type { Owner } from './owner';

/** An owner's session goes after this long without a request to the admin. */
export const SESSION_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/**
 * A signed-in owner's session. The API keeps it in a signed cookie, not in the
 * table, so it holds everything a request needs: who signed in, the CSRF token
 * the admin's state-changing requests must send, and when the owner was last
 * active.
 */
export type AdminSession = {
  readonly owner: Owner;
  readonly csrfToken: string;
  readonly lastActiveAt: Date;
};

/** A new session for `owner`, active as of `now`. */
export function startSession(owner: Owner, now: Date): AdminSession {
  return { owner, csrfToken: randomToken(), lastActiveAt: now };
}

/**
 * Whether the session went idle for longer than the timeout before `now`. A
 * session without a valid activity time is expired too.
 */
export function isExpired(session: AdminSession, now: Date): boolean {
  const idle = now.getTime() - session.lastActiveAt.getTime();
  return !Number.isFinite(idle) || idle >= SESSION_IDLE_TIMEOUT_MS;
}

/** The session after a request at `now`: idle expiry slides forward. */
export function touch(session: AdminSession, now: Date): AdminSession {
  return { ...session, lastActiveAt: now };
}

/** 256 random bits, URL-safe. */
export function randomToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
}
