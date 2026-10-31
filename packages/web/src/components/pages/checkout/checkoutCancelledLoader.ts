import { redirect, type LoaderFunctionArgs } from 'react-router';
import { api } from '../../../api';
import { localeOfPath, localizedPath } from '../../../i18n/locales';
import { paths } from '../../../paths';

/**
 * Where the payment page sends a customer who leaves it without paying
 * (/checkout/cancelled?order=…&token=…): the checkout is cancelled, so its
 * stock is available again, and the customer goes on to their cart, which
 * still has it. If cancelling fails, the cart shows all the same: the stock
 * is released once the payment page expires.
 */
export async function checkoutCancelledLoader({ url }: LoaderFunctionArgs) {
  try {
    await api.checkout.orders[':orderId'].cancel.$post({
      param: { orderId: url.searchParams.get('order') ?? '' },
      json: { token: url.searchParams.get('token') ?? '' },
    });
  } catch {
    // The API could not be reached; the cart is shown anyway.
  }
  return redirect(localizedPath(localeOfPath(url.pathname), paths.cart));
}
