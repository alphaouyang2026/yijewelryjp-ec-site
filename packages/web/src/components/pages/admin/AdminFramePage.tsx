import { useState } from 'react';
import { Outlet, useLoaderData } from 'react-router';
import { api, CSRF_HEADER } from '../../../api';
import { BRAND_NAME } from '../../../brand';
import { browser } from '../../../browser';
import { localizedPath } from '../../../i18n/locales';
import { useLocale } from '../../../i18n/useLocale';
import { useMessages } from '../../../i18n/useMessages';
import { paths } from '../../../paths';
import { AdminLayout } from '../../templates/AdminLayout';
import type { adminSessionLoader } from './adminSessionLoader';

/**
 * Every admin page's frame, shown only in a signed-in owner's session (the
 * loader sends anyone else to sign in). Signing out ends the session at the
 * API, then sends the browser to the identity provider to end its sign-in
 * session too; it comes back to the store's home page.
 */
export function AdminFramePage() {
  const session = useLoaderData<typeof adminSessionLoader>();
  const locale = useLocale();
  const text = useMessages().admin;
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      const res = await api.admin['sign-out'].$post(
        { query: { locale } },
        { headers: { [CSRF_HEADER]: session.csrfToken } },
      );
      // 401: the session had already ended; there is nothing more to sign out of here.
      browser.leaveFor(res.ok ? (await res.json()).signOutUrl : localizedPath(locale, paths.home));
    } catch {
      // The request did not get through (e.g. the network is down), so the
      // session goes on: the button works again and the owner can retry. On
      // success it stays disabled while the browser leaves.
      setSigningOut(false);
    }
  }

  return (
    <AdminLayout owner={{ email: session.owner.email, onSignOut: signOut, signingOut }}>
      <title>{`${text.title} | ${BRAND_NAME}`}</title>
      <meta name="robots" content="noindex" />
      <Outlet />
    </AdminLayout>
  );
}
