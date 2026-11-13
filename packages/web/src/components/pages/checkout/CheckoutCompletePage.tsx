import { useEffect, useRef, useState } from 'react';
import { useLoaderData, useRevalidator, useSearchParams } from 'react-router';
import { BRAND_NAME } from '../../../brand';
import { useMessages } from '../../../i18n/useMessages';
import { paths } from '../../../paths';
import { LocalizedLink } from '../../atoms/LocalizedLink';
import { DetailList } from '../../molecules/DetailList';
import { SectionHeading } from '../../molecules/SectionHeading';
import { StoreLayout } from '../../templates/StoreLayout';
import { useCartQuantity } from '../store/storeFrame';
import styles from './CheckoutCompletePage.module.css';
import type { checkoutCompleteLoader } from './checkoutCompleteLoader';

/** How often the page asks again while the payment is being confirmed, and for how long (a minute). */
const RECHECK_INTERVAL_MS = 3_000;
const MAX_RECHECKS = 20;

/**
 * The thank-you page: the order's number and status. Until the payment
 * service confirms the payment (usually within seconds), the order is
 * pending: the page says it is being confirmed, and asks again every few
 * seconds for a minute. Once it is paid, the page says so and links to the
 * order page; the API has then taken what the order bought out of the cart,
 * so the page reloads once more for the header's cart to show it.
 */
export function CheckoutCompletePage() {
  const { order, categories } = useLoaderData<typeof checkoutCompleteLoader>();
  const [searchParams] = useSearchParams();
  const text = useMessages().checkout;
  const revalidator = useRevalidator();
  const [rechecks, setRechecks] = useState(0);
  const cartRefreshed = useRef(false);

  useEffect(() => {
    if (order.status !== 'pending_payment' || rechecks >= MAX_RECHECKS) return;
    const timer = setTimeout(() => {
      setRechecks((count) => count + 1);
      void revalidator.revalidate();
    }, RECHECK_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [order.status, rechecks, revalidator]);

  useEffect(() => {
    if (order.status !== 'paid' || cartRefreshed.current) return;
    cartRefreshed.current = true;
    void revalidator.revalidate();
  }, [order.status, revalidator]);

  return (
    <StoreLayout categories={categories} cartQuantity={useCartQuantity()}>
      <title>{`${text.title} | ${BRAND_NAME}`}</title>
      <meta name="robots" content="noindex" />
      <div className={styles.page}>
        <SectionHeading level={1} label={text.label} title={text.title} />
        <DetailList
          details={[
            { term: text.orderNumber, value: order.orderNumber },
            { term: text.status, value: <span aria-live="polite">{text.statuses[order.status]}</span> },
          ]}
        />
        {order.status === 'pending_payment' && <p>{text.confirming}</p>}
        {order.status === 'paid' && (
          <>
            <p>{text.paid}</p>
            <LocalizedLink to={paths.order(order.orderNumber, searchParams.get('token') ?? '')} variant="buttonGold">
              {text.viewOrder}
            </LocalizedLink>
          </>
        )}
        <LocalizedLink to={paths.products} variant="buttonOutline">
          {text.continueShopping}
        </LocalizedLink>
      </div>
    </StoreLayout>
  );
}
