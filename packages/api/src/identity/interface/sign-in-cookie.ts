import type { Context } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import { SIGN_IN_TIMEOUT_MS, type PendingSignIn } from '../application/sign-in';
import { COOKIE_OPTIONS } from './session-cookie';

// A sign-in in progress, from the sign-in route to the callback. Signed like
// the session cookie. SameSite=Lax still sends it on the provider's redirect
// back, a top-level GET.
const SIGN_IN_COOKIE = 'yi_admin_sign_in';

type SignInCookie = { state: string; returnTo: string; started: number };

export async function readPendingSignIn(c: Context, secret: string): Promise<PendingSignIn | undefined> {
  const value = await getSignedCookie(c, secret, SIGN_IN_COOKIE, 'host');
  if (!value) return undefined;
  try {
    const cookie = JSON.parse(value) as SignInCookie;
    return { state: cookie.state, returnTo: cookie.returnTo, startedAt: new Date(cookie.started) };
  } catch {
    return undefined;
  }
}

export async function writePendingSignIn(c: Context, secret: string, pending: PendingSignIn) {
  const cookie: SignInCookie = { state: pending.state, returnTo: pending.returnTo, started: pending.startedAt.getTime() };
  await setSignedCookie(c, SIGN_IN_COOKIE, JSON.stringify(cookie), secret, {
    ...COOKIE_OPTIONS,
    maxAge: SIGN_IN_TIMEOUT_MS / 1000,
  });
}

export function clearPendingSignIn(c: Context) {
  deleteCookie(c, SIGN_IN_COOKIE, COOKIE_OPTIONS);
}
