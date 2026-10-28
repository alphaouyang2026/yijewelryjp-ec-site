import { timingSafeEqual } from 'node:crypto';

/** 256 random bits, URL-safe: for values no one may guess, such as a sign-in's state or a session's CSRF token. */
export function randomToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
}

/** Whether `sent` is the token `expected`, compared in constant time so the comparison gives none of it away. */
export function isSameToken(sent: string, expected: string): boolean {
  const a = Buffer.from(sent);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
