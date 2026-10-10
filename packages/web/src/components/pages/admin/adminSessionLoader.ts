import type { LoaderFunctionArgs } from 'react-router';
import { api } from '../../../api';
import { browser } from '../../../browser';
import { localeOfPath } from '../../../i18n/locales';

/**
 * The signed-in owner's session, which every admin page needs. Without one,
 * the browser goes to the API's sign-in (and on to the identity provider's
 * pages, in the page's locale), to come back to this same URL once signed in.
 * The API decides who is signed in; this only chooses what to show.
 */
export async function adminSessionLoader({ url }: LoaderFunctionArgs) {
  const res = await api.admin.session.$get();
  // The API's admin guard answers 401 (AdminUnauthorized) before the route
  // does, so the route's own types do not list that status.
  const status: number = res.status;
  if (status === 401) {
    const returnTo = `${url.pathname}${url.search}`;
    browser.leaveFor(api.admin.auth['sign-in'].$path({ query: { locale: localeOfPath(url.pathname), returnTo } }));
    // The page is going away; render nothing until it does.
    return new Promise<never>(() => {});
  }
  if (!res.ok) throw new Error(`Admin session request failed with status ${res.status}`);
  return res.json();
}
