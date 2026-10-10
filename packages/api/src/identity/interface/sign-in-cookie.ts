import type { Context } from 'hono';
import * as z from 'zod';
import type { SignedCookies } from '../../interface/signed-cookies';
import { LOCALES } from '../../shared-kernel/locale';
import { SIGN_IN_TIMEOUT_MS, type PendingSignIn } from '../application/sign-in';

/**
 * A sign-in in progress, from the sign-in route to the callback
 * (__Host-yi_admin_sign_in). SameSite=Lax still sends it on the provider's
 * redirect back, a top-level GET.
 */
export type SignInCookie = {
  read(c: Context): Promise<PendingSignIn | undefined>;
  write(c: Context, pending: PendingSignIn): Promise<void>;
  clear(c: Context): void;
};

const content = z.object({
  state: z.string().min(1),
  returnTo: z.string(),
  locale: z.enum(LOCALES),
  started: z.number(),
});

export function signInCookie(cookies: SignedCookies): SignInCookie {
  const cookie = cookies.cookie('yi_admin_sign_in', content);
  return {
    async read(c) {
      const pending = await cookie.read(c);
      return (
        pending && {
          state: pending.state,
          returnTo: pending.returnTo,
          locale: pending.locale,
          startedAt: new Date(pending.started),
        }
      );
    },
    async write(c, pending) {
      const value = {
        state: pending.state,
        returnTo: pending.returnTo,
        locale: pending.locale,
        started: pending.startedAt.getTime(),
      };
      await cookie.write(c, value, SIGN_IN_TIMEOUT_MS / 1000);
    },
    clear: (c) => cookie.clear(c),
  };
}
