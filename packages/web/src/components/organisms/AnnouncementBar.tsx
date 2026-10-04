import styles from './AnnouncementBar.module.css';

export function AnnouncementBar() {
  // The threshold comes from the store settings once they exist.
  return <p className={styles.bar}>¥[金額]以上のご購入で、国内送料無料</p>;
}
