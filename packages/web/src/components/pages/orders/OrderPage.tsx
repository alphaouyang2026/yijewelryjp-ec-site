import { useLoaderData } from 'react-router';
import { BRAND_NAME } from '../../../brand';
import { formatDateTime } from '../../../i18n/format';
import { useLocale } from '../../../i18n/useLocale';
import { useMessages } from '../../../i18n/useMessages';
import { DetailList } from '../../molecules/DetailList';
import { SectionHeading } from '../../molecules/SectionHeading';
import { ShippingAddress } from '../../molecules/ShippingAddress';
import { OrderLines } from '../../organisms/OrderLines';
import { StoreLayout } from '../../templates/StoreLayout';
import { useCartQuantity } from '../store/storeFrame';
import styles from './OrderPage.module.css';
import type { orderLoader } from './orderLoader';

/**
 * The order page, which the order confirmation email links to (no account,
 * only the link's token): the order's number, when it was placed, its status,
 * its lines and amounts, and where it ships.
 */
export function OrderPage() {
  const { order, categories } = useLoaderData<typeof orderLoader>();
  const messages = useMessages();
  const text = messages.orderPage;
  const locale = useLocale();

  return (
    <StoreLayout categories={categories} cartQuantity={useCartQuantity()}>
      <title>{`${text.title} | ${BRAND_NAME}`}</title>
      <meta name="robots" content="noindex" />
      <div className={styles.page}>
        <SectionHeading level={1} label={text.label} title={text.title} />
        <DetailList
          details={[
            { term: text.orderNumber, value: order.orderNumber },
            { term: text.placedAt, value: formatDateTime(order.placedAt, locale) },
            { term: text.status, value: messages.checkout.statuses[order.status] },
          ]}
        />
        <OrderLines order={order} />
        <ShippingAddress address={order.shippingAddress} />
        <p className={styles.questions}>{text.questions}</p>
      </div>
    </StoreLayout>
  );
}
