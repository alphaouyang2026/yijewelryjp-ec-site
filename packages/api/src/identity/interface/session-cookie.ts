import type { Context } from 'hono';
import * as z from 'zod';
import type { SignedCookies } from '../../interface/signed-cookies';
import { expiresAt, type AdminSession } from '../application/resume-session';

/**
 * The owner's session, which lives only in this cookie (__Host-yi_admin_session),
 * signed so it cannot be forged or changed. The admin's JavaScript never sees
 * it; it gets the CSRF token from the session endpoint instead.
 */
export type SessionCookie = {
  /** The session in the request's cookie; undefined without one, or for a cookie the API did not issue as a session. */
  read(c: Context): Promise<AdminSession | undefined>;
  /**
   * Sets the cookie to `session`, which is active as of now; the browser drops
   * it once the session could no longer be resumed anyway.
   */
  write(c: Context, session: AdminSession): Promise<void>;
  clear(c: Context): void;
  /** Whether `response` already sets (or deletes) the session cookie. */
  isSetIn(response: Response): boolean;
};

/** The cookie's content. Short keys keep the cookie small; times are milliseconds since the epoch. */
const content = z.object({
  sub: z.string().min(1),
  email: z.string(),
  csrf: z.string().min(1),
  signedIn: z.number(),
  active: z.number(),
});

export function sessionCookie(cookies: SignedCookies): SessionCookie {
  const cookie = cookies.cookie('yi_admin_session', content);
  return {
    async read(c) {
      const session = await cookie.read(c);
      return (
        session && {
          owner: { id: session.sub, email: session.email },
          csrfToken: session.csrf,
          signedInAt: new Date(session.signedIn),
          lastActiveAt: new Date(session.active),
        }
      );
    },
    async write(c, session) {
      const value = {
        sub: session.owner.id,
        email: session.owner.email,
        csrf: session.csrfToken,
        signedIn: session.signedInAt.getTime(),
        active: session.lastActiveAt.getTime(),
      };
      // The session was just started or resumed, so it is active as of now.
      const maxAgeMs = expiresAt(session).getTime() - session.lastActiveAt.getTime();
      await cookie.write(c, value, Math.max(0, Math.ceil(maxAgeMs / 1000)));
    },
    clear: (c) => cookie.clear(c),
    isSetIn: (response) => cookie.isSetIn(response),
  };
}
