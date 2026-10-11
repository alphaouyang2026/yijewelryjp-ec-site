import type { ProductStatus } from '../../api';
import { useMessages } from '../../i18n/useMessages';
import { paths } from '../../paths';
import { PRODUCT_STATUSES } from '../../productStatuses';
import { LocalizedLink } from '../atoms/LocalizedLink';
import styles from './StatusFilter.module.css';

/** Links to the admin's product list with every product, or one status's; the current one is marked. */
export function StatusFilter({ current }: { current: ProductStatus | undefined }) {
  const text = useMessages().admin;
  const options = [
    { status: undefined, label: text.productList.all },
    ...PRODUCT_STATUSES.map((status) => ({ status, label: text.productStatus[status] })),
  ];
  return (
    <nav aria-label={text.productList.filterNav} className={styles.filter}>
      {options.map(({ status, label }) => (
        <LocalizedLink
          key={label}
          to={paths.adminProducts({ status })}
          variant="option"
          aria-current={status === current ? 'page' : undefined}
        >
          {label}
        </LocalizedLink>
      ))}
    </nav>
  );
}
