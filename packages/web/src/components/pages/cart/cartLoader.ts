import type { LoaderFunctionArgs } from 'react-router';
import { api } from '../../../api';
import { localeOfPath } from '../../../i18n/locales';

/** The cart page (/cart): the cart as the API checked and priced it, and the categories for the navigation. */
export async function cartLoader({ url }: LoaderFunctionArgs) {
  const locale = localeOfPath(url.pathname);
  const [cartRes, homeRes] = await Promise.all([api.cart.$get({ query: { locale } }), api.home.$get({ query: { locale } })]);
  if (!cartRes.ok) throw new Error(`Cart request failed with status ${cartRes.status}`);
  if (!homeRes.ok) throw new Error(`Home data request failed with status ${homeRes.status}`);
  const [cart, home] = await Promise.all([cartRes.json(), homeRes.json()]);
  return { cart, categories: home.categories };
}
