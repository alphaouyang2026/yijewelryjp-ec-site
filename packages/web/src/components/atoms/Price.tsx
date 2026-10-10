import styles from './Price.module.css';

/**
 * A tax-inclusive price: `amount` as the site writes it (¥24,000, maybe marked
 * as a starting price) followed by the locale's tax note. `size` is the card
 * or product-page size of spec #1; `ground` the background it sits on.
 */
export function Price({
  amount,
  taxNote,
  size = 'card',
  ground = 'light',
}: {
  amount: string;
  taxNote: string;
  size?: 'card' | 'detail';
  ground?: 'light' | 'dark';
}) {
  return (
    <p className={[styles.price, styles[size], styles[ground]].join(' ')}>
      <span className={styles.amount}>{amount}</span>
      <span className={styles.taxNote}>{taxNote}</span>
    </p>
  );
}
