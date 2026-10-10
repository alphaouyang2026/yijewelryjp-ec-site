import { Hono } from 'hono';
import { localeQuery } from '../../interface/locale-query';
import type { SignOut } from '../application/sign-out';
import type { OwnerEnv } from './owner-only';
import type { SessionCookie } from './session-cookie';

/** The signed-in owner's session, behind the owner-only guard. */
export function adminSessionRoutes({ signOut, sessionCookie }: { signOut: SignOut; sessionCookie: SessionCookie }) {
  return new Hono<OwnerEnv>()
    .get('/session', (c) => {
      const { owner, csrfToken } = c.var.session;
      return c.json({ owner: { email: owner.email }, csrfToken }, 200);
    })
    .post('/sign-out', localeQuery, (c) => {
      sessionCookie.clear(c);
      return c.json(signOut(c.req.valid('query').locale), 200);
    });
}
