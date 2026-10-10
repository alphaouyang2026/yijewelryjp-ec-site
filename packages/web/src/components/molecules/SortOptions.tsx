import type { ProductSort } from '../../api';
import { useMessages } from '../../i18n/useMessages';
import { paths } from '../../paths';
import { PRODUCT_SORTS } from '../../productSorts';
import { LocalizedLink } from '../atoms/LocalizedLink';
import styles from './SortOptions.module.css';

/** Links to the same product list in each sort order; the current one is marked. */
export function SortOptions({ category, current }: { category?: string; current: ProductSort }) {
  const text = useMessages().productList;
  return (
    <nav aria-label={text.sortNav} className={styles.options}>
      {PRODUCT_SORTS.map((sort) => (
        <LocalizedLink
          key={sort}
          to={paths.productList({ category, sort })}
          variant="option"
          aria-current={sort === current ? 'page' : undefined}
        >
          {text.sort[sort]}
        </LocalizedLink>
      ))}
    </nav>
  );
}
