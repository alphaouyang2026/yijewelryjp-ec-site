import type { StockStatus } from '../../api';
import styles from './StockBadge.module.css';

/** A product's or size's stock status, in the look spec #1 gives each status. `text` is the status in the page's locale. */
export function StockBadge({ status, text }: { status: StockStatus; text: string }) {
  return <span className={styles[status]}>{text}</span>;
}
