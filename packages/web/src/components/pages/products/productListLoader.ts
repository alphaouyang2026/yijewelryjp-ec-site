import { data, type LoaderFunctionArgs } from 'react-router';
import { api } from '../../../api';
import { localeOfPath } from '../../../i18n/locales';
import { productSortOf } from '../../../productSorts';

/** Every product (/products) or one category's (/categories/:slug), in the URL's `?sort=` order. */
export async function productListLoader({ url, params }: LoaderFunctionArgs) {
  const category = params.slug;
  const sort = productSortOf(url.searchParams.get('sort'));
  const res = await api.products.$get({
    query: { locale: localeOfPath(url.pathname), sort, ...(category === undefined ? {} : { category }) },
  });
  if (res.status === 404) throw data(null, { status: 404 });
  if (!res.ok) throw new Error(`Product list request failed with status ${res.status}`);
  return { list: await res.json(), sort, category };
}
