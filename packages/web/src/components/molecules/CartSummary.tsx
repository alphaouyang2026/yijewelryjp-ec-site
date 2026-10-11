import { useId } from 'react';
import type { Cart } from '../../api';
import { formatYen } from '../../i18n/format';
import { useMessages } from '../../i18n/useMessages';
import styles from './CartSummary.module.css';

/**
 * The cart's amounts as the API computed them (all tax-inclusive): subtotal,
 * shipping (free once the subtotal reaches the free-shipping threshold) and
 * total, and what is left to free shipping while there is something to buy.
 * It computes no amount itself.
 */
export function CartSummary({ cart }: { cart: Cart }) {
  const text = useMessages().cart;
  const headingId = useId();
  const shippingIsFree = cart.shippingYen === 0 && cart.freeShippingRemainingYen === 0;
  const anythingToBuy = cart.lines.some((line) => line.available);

  return (
    <section aria-labelledby={headingId} className={styles.summary}>
      <h2 id={headingId} className={styles.heading}>
        {text.summary}
      </h2>
      <dl className={styles.amounts}>
        <div className={styles.row}>
          <dt>{text.subtotal}</dt>
          <dd className={styles.amount}>{formatYen(cart.subtotalYen)}</dd>
        </div>
        <div className={styles.row}>
          <dt>{text.shipping}</dt>
          <dd className={shippingIsFree ? styles.free : styles.amount}>
            {shippingIsFree ? text.shippingFree : formatYen(cart.shippingYen)}
          </dd>
        </div>
        <div className={[styles.row, styles.total].join(' ')}>
          <dt>{text.total}</dt>
          <dd className={styles.amount}>{formatYen(cart.totalYen)}</dd>
        </div>
      </dl>
      {anythingToBuy && (
        <p className={styles.freeShipping}>
          {cart.freeShippingRemainingYen > 0
            ? text.freeShippingRemaining(formatYen(cart.freeShippingRemainingYen))
            : text.freeShippingReached}
        </p>
      )}
    </section>
  );
}
