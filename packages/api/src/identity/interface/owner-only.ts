import { timingSafeEqual } from 'node:crypto';
import { createMiddleware } from 'hono/factory';
import { SESSION_IDLE_TIMEOUT_MS, type AdminSession, type ResumeSession } from '../application/resume-session';
import { clearSession, readSession, setsSessionCookie, writeSession } from './session-cookie';

/**
 * The guard's answers when it refuses a request: 401 without a session, 403
 * without the CSRF token. Hono RPC does not see a group middleware's
 * responses, so the API exports these for the frontend.
 */
export type AdminUnauthorized = { error: 'unauthorized' };
export type AdminInvalidCsrfToken = { error: 'invalid_csrf_token' };

/** What the guard gives the admin routes behind it. */
export type OwnerEnv = { Variables: { session: AdminSession } };

/** The request header that carries the session's CSRF token, which the admin gets from GET /api/admin/session. */
export const CSRF_HEADER = 'X-CSRF-Token';
export type CsrfHeader = typeof CSRF_HEADER;

/** Requests that only read; every other method changes data and must prove it comes from the admin. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Guards the admin routes, all in this one place:
 * - every one of them answers 401 unless the request comes in a signed-in
 *   owner's session that has not gone idle;
 * - every one that changes data answers 403 unless the request carries the
 *   session's CSRF token in the X-CSRF-Token header. Another site can make the
 *   browser send the session cookie, but cannot read the token.
 * Each accepted request keeps the session alive for another idle period.
 */
export function ownerOnly({ resumeSession, sessionSecret }: { resumeSession: ResumeSession; sessionSecret: string }) {
  return createMiddleware<OwnerEnv>(async (c, next) => {
    const session = resumeSession(await readSession(c, sessionSecret));
    if (!session) {
      clearSession(c);
      return c.json<AdminUnauthorized>({ error: 'unauthorized' }, 401);
    }
    if (!SAFE_METHODS.has(c.req.method) && !sameToken(c.req.header(CSRF_HEADER), session.csrfToken)) {
      return c.json<AdminInvalidCsrfToken>({ error: 'invalid_csrf_token' }, 403);
    }

    c.set('session', session);
    await next();
    // Unless the route ended the session (signing out), the cookie carries the new activity time.
    if (!setsSessionCookie(c.res)) await writeSession(c, sessionSecret, session, SESSION_IDLE_TIMEOUT_MS / 1000);
  });
}

function sameToken(sent: string | undefined, expected: string): boolean {
  if (sent === undefined) return false;
  const a = Buffer.from(sent);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
