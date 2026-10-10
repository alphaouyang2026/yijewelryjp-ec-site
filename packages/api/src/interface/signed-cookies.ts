import { createHmac } from 'node:crypto';
import type { Context } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import type { CookieOptions } from 'hono/utils/cookie';
import type * as z from 'zod';

/**
 * Every cookie the API sets: only for this host, over HTTPS, path / (the
 * __Host- prefix), HTTP-only (the site's JavaScript never reads them), and
 * SameSite=Lax (sent on top-level navigations from other sites, such as the
 * identity provider's redirect back, but not on their requests).
 */
const COOKIE_OPTIONS: CookieOptions = {
  prefix: 'host',
  path: '/',
  secure: true,
  httpOnly: true,
  sameSite: 'Lax',
};

/**
 * One cookie the API signs, whose content is JSON of a fixed shape. Only the
 * API can make a cookie that `read` accepts, and only as this cookie: another
 * of the API's signed cookies, or this one changed in any way, reads as no
 * cookie at all.
 */
export type SignedCookie<Content> = {
  /** The cookie's content; undefined when there is none, its signature is not this cookie's, or it is not of the cookie's shape. */
  read(c: Context): Promise<Content | undefined>;
  /** Sets the cookie to `content`; the browser keeps it for `maxAgeSeconds`. */
  write(c: Context, content: Content, maxAgeSeconds: number): Promise<void>;
  /** Tells the browser to drop the cookie. */
  clear(c: Context): void;
  /** Whether `response` already sets (or drops) the cookie. */
  isSetIn(response: Response): boolean;
};

/** Makes the API's signed cookies, all from one secret. */
export type SignedCookies = {
  /** The signed cookie `name`, whose content `schema` checks each time it is read. */
  cookie<Content>(name: string, schema: z.ZodType<Content>): SignedCookie<Content>;
};

/**
 * The API's signed cookies, from `secret` (production keeps it in Secrets
 * Manager). Each cookie is signed with its own key, derived from the secret
 * and the cookie's name: a signature covers only a cookie's value, so with
 * one key for all, one cookie's value would pass as another's.
 */
export function signedCookies(secret: string): SignedCookies {
  if (!secret) throw new Error('The cookie signing secret must not be empty');

  return {
    cookie<Content>(name: string, schema: z.ZodType<Content>): SignedCookie<Content> {
      const key = createHmac('sha256', secret).update(`signed-cookie:${name}`).digest();
      const prefixed = `__Host-${name}=`;

      return {
        async read(c) {
          const value = await getSignedCookie(c, key, name, 'host');
          if (!value) return undefined;
          const content = schema.safeParse(parseJson(value));
          return content.success ? content.data : undefined;
        },
        async write(c, content, maxAgeSeconds) {
          await setSignedCookie(c, name, JSON.stringify(content), key, { ...COOKIE_OPTIONS, maxAge: maxAgeSeconds });
        },
        clear(c) {
          deleteCookie(c, name, COOKIE_OPTIONS);
        },
        isSetIn(response) {
          return response.headers.getSetCookie().some((cookie) => cookie.startsWith(prefixed));
        },
      };
    },
  };
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
