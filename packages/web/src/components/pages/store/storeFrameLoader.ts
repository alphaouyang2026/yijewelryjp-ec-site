import type { LoaderFunctionArgs } from 'react-router';
import { api } from '../../../api';
import { localeOfPath } from '../../../i18n/locales';

/**
 * What every store page's frame needs: how many the cart holds (its
 * quantity), for the header. Null when the cart could not be read: the header
 * then shows the cart without a count, and the store can still be browsed.
 */
export async function storeFrameLoader({ url }: LoaderFunctionArgs): Promise<{ cartQuantity: number | null }> {
  try {
    const res = await api.cart.$get({ query: { locale: localeOfPath(url.pathname) } });
    if (!res.ok) return { cartQuantity: null };
    return { cartQuantity: (await res.json()).quantity };
  } catch {
    return { cartQuantity: null };
  }
}
