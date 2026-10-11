import type { AdminProductSummary } from '../../api';
import { formatYen } from '../../i18n/format';
import { useMessages } from '../../i18n/useMessages';
import { paths } from '../../paths';
import { LocalizedLink } from '../atoms/LocalizedLink';
import styles from './AdminProductTable.module.css';

/**
 * The admin's products as a table: each one's name (linking to its edit
 * page), status, category, lowest price, stock on hand (and how much of it
 * checkouts hold), and whether it is featured. `emptyText` when there are none.
 */
export function AdminProductTable({ products, emptyText }: { products: AdminProductSummary[]; emptyText: string }) {
  const text = useMessages();
  const list = text.admin.productList;
  if (products.length === 0) return <p className={styles.empty}>{emptyText}</p>;

  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{list.columns.name}</th>
            <th scope="col">{list.columns.status}</th>
            <th scope="col">{list.columns.category}</th>
            <th scope="col">{list.columns.price}</th>
            <th scope="col">{list.columns.stock}</th>
            <th scope="col">{list.columns.featured}</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const price = formatYen(product.priceYen);
            return (
              <tr key={product.slug}>
                <td>
                  <LocalizedLink to={paths.adminEditProduct(product.slug)} className={styles.name}>
                    {product.name}
                  </LocalizedLink>
                </td>
                <td>{text.admin.productStatus[product.status]}</td>
                <td>{product.category?.name ?? list.none}</td>
                <td className={styles.number}>{product.priceVaries ? text.price.from(price) : price}</td>
                <td className={styles.number}>
                  {product.onHandStock}
                  {product.reservedStock > 0 && list.reserved(product.reservedStock)}
                </td>
                <td>{product.featured ? list.featured : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
