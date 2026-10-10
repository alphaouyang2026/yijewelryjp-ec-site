import { paths } from '../../paths';
import { LocalizedLink } from '../atoms/LocalizedLink';
import styles from './PageMessage.module.css';

/** A page that only has something to say, such as "page not found": its title, a line of text, and a link home. */
export function PageMessage({ title, text, homeLink }: { title: string; text: string; homeLink: string }) {
  return (
    <div className={styles.message}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.text}>{text}</p>
      <LocalizedLink to={paths.home} variant="buttonOutline">
        {homeLink}
      </LocalizedLink>
    </div>
  );
}
