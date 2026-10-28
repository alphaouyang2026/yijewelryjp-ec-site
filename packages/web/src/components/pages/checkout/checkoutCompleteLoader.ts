import { data, type LoaderFunctionArgs } from 'react-router';
import { api } from '../../../api';
import { localeOfPath } from '../../../i18n/locales';

/**
 * The thank-you page (/checkout/complete?order=…&token=…), where the payment
 * page sends the customer once they have paid: the order the URL names, which
 * the API finds only with its checkout token (404 otherwise), and the
 * categories for the navigation.
 */
export async function checkoutCompleteLoader({ url }: LoaderFunctionArgs) {
  const locale = localeOfPath(url.pathname);
  const [orderRes, homeRes] = await Promise.all([
    api.checkout.orders[':orderId'].$get({
      param: { orderId: url.searchParams.get('order') ?? '' },
      query: { token: url.searchParams.get('token') ?? '' },
    }),
    api.home.$get({ query: { locale } }),
  ]);
  if (orderRes.status === 404) throw data(null, { status: 404 });
  if (!orderRes.ok) throw new Error(`Order request failed with status ${orderRes.status}`);
  if (!homeRes.ok) throw new Error(`Home data request failed with status ${homeRes.status}`);
  const [order, home] = await Promise.all([orderRes.json(), homeRes.json()]);
  return { order, categories: home.categories };
}
