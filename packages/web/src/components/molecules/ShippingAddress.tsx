import { useId } from 'react';
import type { OrderPage } from '../../api';
import { useMessages } from '../../i18n/useMessages';
import styles from './ShippingAddress.module.css';

/**
 * Where an order ships, as a Japanese address label has it: postal code, the
 * address, then the recipient; until the order is paid there is no address yet.
 */
export function ShippingAddress({ address }: { address: OrderPage['shippingAddress'] }) {
  const text = useMessages().orderPage;
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={styles.address}>
      <h2 id={headingId} className={styles.heading}>
        {text.shippingAddress}
      </h2>
      {address ? (
        <address className={styles.lines}>
          <span>〒{address.postalCode}</span>
          <span>
            {address.prefecture}
            {address.city}
            {address.line1}
            {address.line2 ? ` ${address.line2}` : ''}
          </span>
          <span>{text.recipient(address.name)}</span>
        </address>
      ) : (
        <p className={styles.pending}>{text.addressPending}</p>
      )}
    </section>
  );
}
