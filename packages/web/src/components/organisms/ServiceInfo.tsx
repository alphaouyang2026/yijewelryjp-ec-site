import { useMessages } from '../../i18n/useMessages';
import { Icon, type IconName } from '../atoms/Icon';
import styles from './ServiceInfo.module.css';

/** Shipping, payment and contact, side by side on a mist band (home mock). */
export function ServiceInfo() {
  const text = useMessages().home;
  const items: { icon: IconName; title: string; body: string }[] = [
    { icon: 'truck', title: text.shippingTitle, body: text.shippingText },
    { icon: 'lock', title: text.paymentTitle, body: text.paymentText },
    { icon: 'mail', title: text.contactTitle, body: text.contactText },
  ];

  return (
    <div className={styles.band}>
      <ul className={styles.items}>
        {items.map((item) => (
          <li key={item.icon} className={styles.item}>
            <span className={styles.icon}>
              <Icon name={item.icon} />
            </span>
            <div>
              <h2 className={styles.title}>{item.title}</h2>
              <p className={styles.body}>{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
