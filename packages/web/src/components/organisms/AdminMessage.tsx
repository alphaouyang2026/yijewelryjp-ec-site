import type { PagePath } from '../../paths';
import { LocalizedLink } from '../atoms/LocalizedLink';
import styles from './AdminMessage.module.css';

/** An admin page that only has something to say: its title, a line of text, and maybe a link onward. */
export function AdminMessage({
  title,
  text,
  link,
}: {
  title: string;
  text: string;
  link?: { to: PagePath; text: string };
}) {
  return (
    <div className={styles.message}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.text}>{text}</p>
      {link && (
        <LocalizedLink to={link.to} variant="buttonOutline" className={styles.link}>
          {link.text}
        </LocalizedLink>
      )}
    </div>
  );
}
