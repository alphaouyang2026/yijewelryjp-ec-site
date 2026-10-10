import type { Context } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import type { CookieOptions } from 'hono/utils/cookie';
import type { AdminSession } from '../application/resume-session';

// The owner's session lives only in this cookie, signed with the session
// secret so it cannot be forged or changed. HTTP-only: the admin's JavaScript
// never sees it (it gets the CSRF token from the session endpoint instead).
// __Host-: only this host, over HTTPS, path /.
const SESSION_COOKIE = 'yi_admin_session';

export const COOKIE_OPTIONS: CookieOptions = {
  prefix: 'host',
  path: '/',
  secure: true,
  httpOnly: true,
  sameSite: 'Lax',
};

/** The cookie's content. Short keys keep the cookie small. */
type SessionCookie = { sub: string; email: string; csrf: string; active: number };

export async function readSession(c: Context, secret: string): Promise<AdminSession | undefined> {
  const value = await getSignedCookie(c, secret, SESSION_COOKIE, 'host');
  if (!value) return undefined;
  try {
    const cookie = JSON.parse(value) as SessionCookie;
    return {
      owner: { id: cookie.sub, email: cookie.email },
      csrfToken: cookie.csrf,
      lastActiveAt: new Date(cookie.active),
    };
  } catch {
    return undefined;
  }
}

/** Sets the session cookie; the browser drops it once the session could no longer be resumed anyway. */
export async function writeSession(c: Context, secret: string, session: AdminSession, maxAgeSeconds: number) {
  const cookie: SessionCookie = {
    sub: session.owner.id,
    email: session.owner.email,
    csrf: session.csrfToken,
    active: session.lastActiveAt.getTime(),
  };
  await setSignedCookie(c, SESSION_COOKIE, JSON.stringify(cookie), secret, { ...COOKIE_OPTIONS, maxAge: maxAgeSeconds });
}

/** Whether `response` already sets (or deletes) the session cookie. */
export function setsSessionCookie(response: Response): boolean {
  return response.headers.getSetCookie().some((cookie) => cookie.startsWith(`__Host-${SESSION_COOKIE}=`));
}

export function clearSession(c: Context) {
  deleteCookie(c, SESSION_COOKIE, COOKIE_OPTIONS);
}
