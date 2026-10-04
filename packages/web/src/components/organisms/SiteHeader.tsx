import { Link } from 'react-router';
import type { Category } from '../../api';
import { BRAND_NAME } from '../../brand';
import { paths } from '../../paths';
import { Icon } from '../atoms/Icon';
import { Logo } from '../atoms/Logo';
import { NavLinkList } from '../molecules/NavLinkList';
import { categoryLinks } from './categoryLinks';
import styles from './SiteHeader.module.css';

export function SiteHeader({ categories }: { categories: Category[] }) {
  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <Link to={paths.home} className={styles.logoLink}>
          <Logo alt={BRAND_NAME} size="header" />
        </Link>
        <Link to={paths.cart} aria-label="カート" className={styles.cart}>
          <Icon name="bag" />
        </Link>
      </div>
      <nav aria-label="カテゴリー" className={styles.nav}>
        <NavLinkList links={categoryLinks(categories)} variant="header" />
      </nav>
    </header>
  );
}
