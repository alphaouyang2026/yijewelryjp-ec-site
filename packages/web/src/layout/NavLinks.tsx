import { Link } from 'react-router';

/** One entry of a navigation list: the page's path and the link text. */
export type NavLinkItem = { to: string; label: string };

/** Renders the entries as router links in order, each with `className`. */
export function NavLinks({ links, className }: { links: NavLinkItem[]; className?: string }) {
  return (
    <>
      {links.map((link) => (
        <Link key={link.to} to={link.to} className={className}>
          {link.label}
        </Link>
      ))}
    </>
  );
}
