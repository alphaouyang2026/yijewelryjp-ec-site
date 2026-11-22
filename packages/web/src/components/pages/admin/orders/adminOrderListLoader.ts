import type { LoaderFunctionArgs } from 'react-router';
import { api } from '../../../../api';
import { orderStatusOf } from '../../../../orderStatuses';

/** The admin's orders: those the owner has something to do for, or the URL's `?status=` only. */
export async function adminOrderListLoader({ url }: LoaderFunctionArgs) {
  const status = orderStatusOf(url.searchParams.get('status'));
  const res = await api.admin.orders.$get({ query: status === undefined ? {} : { status } });
  if (!res.ok) throw new Error(`Admin order list request failed with status ${res.status}`);
  return { list: await res.json(), status };
}
