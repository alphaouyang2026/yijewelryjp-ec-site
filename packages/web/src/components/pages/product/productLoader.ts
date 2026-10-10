import { data, type LoaderFunctionArgs } from 'react-router';
import { api } from '../../../api';
import { localeOfPath } from '../../../i18n/locales';

/** A listed product's page (/products/:slug); 404 for any other product. */
export async function productLoader({ url, params }: LoaderFunctionArgs) {
  const res = await api.products[':slug'].$get({
    param: { slug: params.slug ?? '' },
    query: { locale: localeOfPath(url.pathname) },
  });
  if (res.status === 404) throw data(null, { status: 404 });
  if (!res.ok) throw new Error(`Product request failed with status ${res.status}`);
  return res.json();
}
