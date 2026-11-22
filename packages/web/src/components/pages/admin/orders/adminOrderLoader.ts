import { data, type LoaderFunctionArgs } from 'react-router';
import { api } from '../../../../api';
import { localeOfPath } from '../../../../i18n/locales';

/** The order the URL names, its texts in the page's locale; the admin's error page if there is none. */
export async function adminOrderLoader({ url, params }: LoaderFunctionArgs) {
  const res = await api.admin.orders[':orderNumber'].$get({
    param: { orderNumber: params.orderNumber ?? '' },
    query: { locale: localeOfPath(url.pathname) },
  });
  // The admin guard's 401 is not in the route's types; any status but 200 and 404 is a failure.
  const status: number = res.status;
  if (status === 404) throw data(null, { status: 404 });
  if (!res.ok) throw new Error(`Admin order request failed with status ${status}`);
  return { order: await res.json() };
}
