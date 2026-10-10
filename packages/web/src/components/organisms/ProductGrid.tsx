import type { ProductSummary } from '../../api';
import { ProductCard } from '../molecules/ProductCard';
import styles from './ProductGrid.module.css';

/** Products as a grid of cards (4 across on desktop, 2 on phones), or `emptyText` when there are none. */
export function ProductGrid({
  products,
  emptyText,
  headingLevel,
}: {
  products: ProductSummary[];
  emptyText: string;
  headingLevel: 2 | 3;
}) {
  if (products.length === 0) return <p className={styles.empty}>{emptyText}</p>;
  return (
    <ul className={styles.grid}>
      {products.map((product) => (
        <li key={product.slug}>
          <ProductCard product={product} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}
