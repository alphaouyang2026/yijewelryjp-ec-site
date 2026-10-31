import { useId } from 'react';
import type { OrderPage } from '../../api';
import { formatYen } from '../../i18n/format';
import { useMessages } from '../../i18n/useMessages';
import styles from './OrderLines.module.css';

/**
 * An order's lines and amounts as the API computed them (all tax-inclusive):
 * each line's unit price, quantity and amount, then the subtotal, shipping,
 * and the total with the consumption tax it includes. It computes no amount itself.
 */
export function OrderLines({ order }: { order: OrderPage }) {
  const text = useMessages().orderPage;
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={styles.lines}>
      <h2 id={headingId} className={styles.heading}>
        {text.items}
      </h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{text.columns.item}</th>
            <th scope="col" className={styles.number}>
              {text.columns.unitPrice}
            </th>
            <th scope="col" className={styles.number}>
              {text.columns.quantity}
            </th>
            <th scope="col" className={styles.number}>
              {text.columns.amount}
            </th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line, index) => (
            <tr key={index}>
              <td>
                <span className={styles.name}>{line.name}</span>
                {line.variantLabel && <span className={styles.variant}>{line.variantLabel}</span>}
              </td>
              <td className={styles.number}>{formatYen(line.unitPriceYen)}</td>
              <td className={styles.number}>{line.quantity}</td>
              <td className={styles.number}>{formatYen(line.lineAmountYen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className={styles.amounts}>
        <div className={styles.row}>
          <dt>{text.subtotal}</dt>
          <dd>{formatYen(order.subtotalYen)}</dd>
        </div>
        <div className={styles.row}>
          <dt>{text.shipping}</dt>
          <dd>{formatYen(order.shippingYen)}</dd>
        </div>
        <div className={[styles.row, styles.total].join(' ')}>
          <dt>{text.total}</dt>
          <dd>{text.totalWithTax(formatYen(order.totalYen), formatYen(order.taxYen))}</dd>
        </div>
      </dl>
    </section>
  );
}
