import { Link } from 'react-router';
import type { Category } from '../../api';
import { BRAND_NAME } from '../../brand';
import { useMessages } from '../../i18n/useMessages';
import { paths } from '../../paths';
import { Icon } from '../atoms/Icon';
import { Logo } from '../atoms/Logo';
import { NavLinkList } from '../molecules/NavLinkList';
import styles from './SiteHeader.module.css';
import { useCategoryLinks } from './useCategoryLinks';

export function SiteHeader({ categories }: { categories: Category[] }) {
  const text = useMessages().header;
  const categoryLinks = useCategoryLinks(categories);

  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <Link to={paths.home} className={styles.logoLink}>
          <Logo alt={BRAND_NAME} size="header" />
        </Link>
        <Link to={paths.cart} aria-label={text.cart} className={styles.cart}>
          <Icon name="bag" />
        </Link>
      </div>
      <nav aria-label={text.categoriesNav} className={styles.nav}>
        <NavLinkList links={categoryLinks} variant="header" />
      </nav>
    </header>
  );
}
