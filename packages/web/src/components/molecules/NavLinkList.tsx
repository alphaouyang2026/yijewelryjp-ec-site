import type { PagePath } from '../../paths';
import { LocalizedLink } from '../atoms/LocalizedLink';
import styles from './NavLinkList.module.css';

/** One entry of a navigation list: the page's path (from paths.ts) and the link text. */
export type NavLinkItem = { to: PagePath; text: string };

/** The links' look in each list. */
const LINK_VARIANT = { header: 'nav', footer: 'caption' } as const;

/**
 * The entries as a list of links on a dark ground, in order: a centred,
 * wrapping row for the header or a column for the footer.
 */
export function NavLinkList({ links, variant }: { links: NavLinkItem[]; variant: 'header' | 'footer' }) {
  return (
    <ul className={styles[variant]}>
      {links.map((link) => (
        <li key={link.to}>
          <LocalizedLink to={link.to} variant={LINK_VARIANT[variant]}>
            {link.text}
          </LocalizedLink>
        </li>
      ))}
    </ul>
  );
}
