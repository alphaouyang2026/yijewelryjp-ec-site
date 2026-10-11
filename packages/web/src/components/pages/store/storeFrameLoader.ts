import type { LoaderFunctionArgs } from 'react-router';
import { api } from '../../../api';
import { localeOfPath } from '../../../i18n/locales';

/**
 * What every store page's frame needs: how many items the cart holds, for the
 * header. Null when the cart could not be read: the header then shows the
 * cart without a count, and the store can still be browsed.
 */
export async function storeFrameLoader({ url }: LoaderFunctionArgs): Promise<{ cartItemCount: number | null }> {
  try {
    const res = await api.cart.$get({ query: { locale: localeOfPath(url.pathname) } });
    if (!res.ok) return { cartItemCount: null };
    return { cartItemCount: (await res.json()).itemCount };
  } catch {
    return { cartItemCount: null };
  }
}
