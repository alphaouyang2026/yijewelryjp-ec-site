import { Link } from 'react-router';
import styles from './NavLinkList.module.css';

/** One entry of a navigation list: the page's path and the link text. */
export type NavLinkItem = { to: string; label: string };

/**
 * The entries as a list of links on a dark ground, in order: a centred,
 * wrapping row for the header or a column for the footer.
 */
export function NavLinkList({ links, variant }: { links: NavLinkItem[]; variant: 'header' | 'footer' }) {
  return (
    <ul className={styles[variant]}>
      {links.map((link) => (
        <li key={link.to}>
          <Link to={link.to} className={styles.link}>
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
