import { describe, expect, test } from 'vitest';
import { useTestApi } from './support/test-api';

// Session cookies the API did not issue as session cookies. Each must get 401
// on every admin route, reading or changing data, never another answer.

const api = useTestApi({ withTable: false });

/** The value of the cookie `name` that `response` sets. */
function cookieValue(response: Response, name: string): string {
  const cookie = response.headers.getSetCookie().find((setCookie) => setCookie.startsWith(`${name}=`));
  if (!cookie) throw new Error(`Expected the response to set ${name}`);
  return cookie.slice(name.length + 1).split(';')[0] ?? '';
}

/** A read and a data-changing admin request carrying `cookie` as the session cookie. */
async function adminRequestsWith(cookie: string) {
  const headers = { cookie: `__Host-yi_admin_session=${cookie}` };
  const read = await api.request('/api/admin/session', { headers });
  const change = await api.request('/api/admin/sign-out?locale=ja', {
    method: 'POST',
    headers: { ...headers, 'X-CSRF-Token': 'undefined' },
  });
  return { read, change };
}

describe('a session cookie the API did not issue as one is refused', () => {
  test('the signed sign-in cookie, sent as the session cookie', async () => {
    const start = await api.request('/api/admin/auth/sign-in?locale=ja&returnTo=/admin');
    const signInCookie = cookieValue(start, '__Host-yi_admin_sign_in');

    const { read, change } = await adminRequestsWith(signInCookie);

    expect(read.status).toBe(401);
    expect(change.status).toBe(401);
  });

  test('a session cookie with its content changed', async () => {
    const client = api.client();
    const signIn = await api.signIn(client);
    const cookie = cookieValue(signIn, '__Host-yi_admin_session');
    const tampered = cookie.replace(/owner%40yijewelry\.test|owner@yijewelry\.test/, 'intruder@evil.test');
    expect(tampered).not.toBe(cookie);

    const { read, change } = await adminRequestsWith(tampered);

    expect(read.status).toBe(401);
    expect(change.status).toBe(401);
  });

  // Signed with the session cookie's own key, as only someone who has the
  // signing secret could: the API still checks the content's shape.
  const owner = { sub: 'owner-1', email: 'owner@yijewelry.test', csrf: 'csrf-token' };
  test.each([
    { case: 'no activity time', content: owner },
    { case: 'an activity time that is not a time', content: { ...owner, active: 'soon' } },
    { case: 'an activity time that is not a number', content: { ...owner, active: null } },
    { case: 'a CSRF token that is not text', content: { ...owner, csrf: 42, active: Date.now() } },
    { case: 'no owner', content: { csrf: 'csrf-token', active: Date.now() } },
    { case: 'text instead of a session', content: 'signed-in' },
    { case: 'nothing', content: null },
  ])('a session cookie signed by the API, with $case', async ({ content }) => {
    const forged = await api.request('/api/_test/session-cookie', { method: 'POST', body: JSON.stringify(content) });
    const cookie = cookieValue(forged, '__Host-yi_admin_session');

    const { read, change } = await adminRequestsWith(cookie);

    expect(read.status).toBe(401);
    expect(change.status).toBe(401);
  });
});
