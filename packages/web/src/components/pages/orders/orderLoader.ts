import { data, type LoaderFunctionArgs } from 'react-router';
import { api } from '../../../api';
import { localeOfPath } from '../../../i18n/locales';

/**
 * The order page (/orders/:orderNumber?token=…), which the order
 * confirmation email links to: the order in the page's locale, which the API
 * finds only with its checkout token (404 otherwise), and the categories for
 * the navigation.
 */
export async function orderLoader({ params, url }: LoaderFunctionArgs) {
  const locale = localeOfPath(url.pathname);
  const [orderRes, homeRes] = await Promise.all([
    api.orders[':orderId'].$get({
      param: { orderId: params.orderNumber ?? '' },
      query: { token: url.searchParams.get('token') ?? '', locale },
    }),
    api.home.$get({ query: { locale } }),
  ]);
  if (orderRes.status === 404) throw data(null, { status: 404 });
  if (!orderRes.ok) throw new Error(`Order request failed with status ${orderRes.status}`);
  if (!homeRes.ok) throw new Error(`Home data request failed with status ${homeRes.status}`);
  const [order, home] = await Promise.all([orderRes.json(), homeRes.json()]);
  return { order, categories: home.categories };
}
