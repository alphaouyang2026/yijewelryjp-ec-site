import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';
import { localeQueryWith } from '../../interface/locale-query';
import type { BeginSignIn, FinishSignIn } from '../application/sign-in';
import type { SessionCookie } from './session-cookie';
import type { SignInCookie } from './sign-in-cookie';

/**
 * A path on this site (never another host, so the sign-in cannot be used to
 * send the browser elsewhere): starts with one slash, no backslashes or
 * whitespace.
 */
const sitePath = z.string().regex(/^\/(?![/\\])[^\s\\]*$/);

const signInQuery = localeQueryWith({ returnTo: sitePath });

// The provider sends back a code and the state, or an error (e.g. the owner cancelled).
const callbackQuery = zValidator(
  'query',
  z.object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() }),
);

/**
 * The owner's sign-in, open to everyone: the browser starts here and the
 * identity provider sends it back here. These are the only admin routes
 * outside the owner-only guard.
 */
export function signInRoutes({
  beginSignIn,
  finishSignIn,
  signInCookie,
  sessionCookie,
}: {
  beginSignIn: BeginSignIn;
  finishSignIn: FinishSignIn;
  signInCookie: SignInCookie;
  sessionCookie: SessionCookie;
}) {
  return new Hono()
    .get('/sign-in', signInQuery, async (c) => {
      const { signInUrl, pending } = beginSignIn(c.req.valid('query'));
      await signInCookie.write(c, pending);
      return c.redirect(signInUrl, 302);
    })
    .get('/callback', callbackQuery, async (c) => {
      const { code, state, error } = c.req.valid('query');
      const pending = await signInCookie.read(c);
      signInCookie.clear(c);

      const signedIn = code && state && !error ? await finishSignIn({ code, state, pending }) : undefined;
      if (!signedIn) {
        console.warn('Admin sign-in failed', { providerError: error ?? null, pending: Boolean(pending) });
        return c.json({ error: 'sign_in_failed' as const }, 400);
      }

      await sessionCookie.write(c, signedIn.session);
      return c.redirect(signedIn.returnTo, 302);
    });
}
