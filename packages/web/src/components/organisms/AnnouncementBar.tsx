import { useMessages } from '../../i18n/useMessages';
import styles from './AnnouncementBar.module.css';

export function AnnouncementBar() {
  // The threshold comes from the store settings once they exist.
  return <p className={styles.bar}>{useMessages().announcement.freeShipping}</p>;
}
