/** 256 random bits, URL-safe: for values no one may guess, such as a sign-in's state or a session's CSRF token. */
export function randomToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
}
