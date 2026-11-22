import type { AdminOrderSummary } from '../../api';
import { formatDateTime, formatYen } from '../../i18n/format';
import { useLocale } from '../../i18n/useLocale';
import { useMessages } from '../../i18n/useMessages';
import { paths } from '../../paths';
import { LocalizedLink } from '../atoms/LocalizedLink';
import styles from './AdminTable.module.css';

/**
 * The admin's orders as a table: each one's number (linking to its page),
 * when it was placed, who receives it, how many pieces, its total and its
 * status. `emptyText` when there are none.
 */
export function AdminOrderTable({ orders, emptyText }: { orders: AdminOrderSummary[]; emptyText: string }) {
  const locale = useLocale();
  const text = useMessages().admin;
  const list = text.orderList;
  if (orders.length === 0) return <p className={styles.empty}>{emptyText}</p>;

  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{list.columns.orderNumber}</th>
            <th scope="col">{list.columns.placedAt}</th>
            <th scope="col">{list.columns.recipient}</th>
            <th scope="col">{list.columns.quantity}</th>
            <th scope="col">{list.columns.total}</th>
            <th scope="col">{list.columns.status}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.orderNumber}>
              <td>
                <LocalizedLink to={paths.adminOrder(order.orderNumber)} className={styles.name}>
                  {order.orderNumber}
                </LocalizedLink>
              </td>
              <td>{formatDateTime(order.placedAt, locale)}</td>
              <td>{order.recipient ?? list.none}</td>
              <td className={styles.number}>{order.quantity}</td>
              <td className={styles.number}>{formatYen(order.totalYen)}</td>
              <td>{text.orderStatus[order.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
