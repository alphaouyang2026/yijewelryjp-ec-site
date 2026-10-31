import { useLoaderData } from 'react-router';
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

/**
 * The thank-you page: the order's number and status. Until the payment
 * service confirms the payment, the order is pending, and the page says it is
 * being confirmed rather than paid.
 */
export function CheckoutCompletePage() {
  const { order, categories } = useLoaderData<typeof checkoutCompleteLoader>();
  const text = useMessages().checkout;

  return (
    <StoreLayout categories={categories} cartQuantity={useCartQuantity()}>
      <title>{`${text.title} | ${BRAND_NAME}`}</title>
      <meta name="robots" content="noindex" />
      <div className={styles.page}>
        <SectionHeading level={1} label={text.label} title={text.title} />
        <DetailList
          details={[
            { term: text.orderNumber, value: order.orderNumber },
            { term: text.status, value: text.statuses[order.status] },
          ]}
        />
        {order.status === 'pending_payment' && <p>{text.confirming}</p>}
        <LocalizedLink to={paths.products} variant="buttonOutline">
          {text.continueShopping}
        </LocalizedLink>
      </div>
    </StoreLayout>
  );
}
