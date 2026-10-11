import type { LoaderFunctionArgs } from 'react-router';
import { api } from '../../../../api';
import { localeOfPath } from '../../../../i18n/locales';
import { productStatusOf } from '../../../../productStatuses';

/** The admin's products, every one or the URL's `?status=` only, named in the page's locale. */
export async function adminProductListLoader({ url }: LoaderFunctionArgs) {
  const status = productStatusOf(url.searchParams.get('status'));
  const res = await api.admin.products.$get({
    query: { locale: localeOfPath(url.pathname), ...(status === undefined ? {} : { status }) },
  });
  if (!res.ok) throw new Error(`Admin product list request failed with status ${res.status}`);
  return { list: await res.json(), status };
}
