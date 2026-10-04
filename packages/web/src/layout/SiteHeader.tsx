import { Link } from 'react-router';
import type { Category } from '../api';
import { BRAND_NAME, LOGO_FILE_SIZE, logoUrl } from '../brand';
import { paths } from '../paths';
import { categoryLinks } from './categoryLinks';
import { NavLinks } from './NavLinks';
import styles from './SiteHeader.module.css';

export function SiteHeader({ categories }: { categories: Category[] }) {
  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <Link to={paths.home} className={styles.logoLink}>
          <img
            src={logoUrl}
            alt={BRAND_NAME}
            width={LOGO_FILE_SIZE.width}
            height={LOGO_FILE_SIZE.height}
            className={styles.logo}
          />
        </Link>
        <Link to={paths.cart} aria-label="カート" className={styles.cart}>
          <BagIcon />
        </Link>
      </div>
      <nav aria-label="カテゴリー" className={styles.nav}>
        <NavLinks links={categoryLinks(categories)} className={styles.navLink} />
      </nav>
    </header>
  );
}

function BagIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 8h14l-1.2 13H6.2L5 8z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  );
}
