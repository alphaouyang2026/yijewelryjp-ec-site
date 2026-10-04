import type { Category } from '../../api';
import { BRAND_NAME } from '../../brand';
import { useMessages } from '../../i18n/useMessages';
import { paths } from '../../paths';
import { Icon } from '../atoms/Icon';
import { LocalizedLink } from '../atoms/LocalizedLink';
import { Logo } from '../atoms/Logo';
import { LanguageSwitcher } from '../molecules/LanguageSwitcher';
import { NavLinkList } from '../molecules/NavLinkList';
import styles from './SiteHeader.module.css';
import { useCategoryLinks } from './useCategoryLinks';

export function SiteHeader({ categories }: { categories: Category[] }) {
  const text = useMessages().header;
  const categoryLinks = useCategoryLinks(categories);

  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <LanguageSwitcher className={styles.languages} />
        <LocalizedLink to={paths.home} className={styles.logoLink}>
          <Logo alt={BRAND_NAME} size="header" />
        </LocalizedLink>
        <LocalizedLink to={paths.cart} aria-label={text.cart} className={styles.cart}>
          <Icon name="bag" />
        </LocalizedLink>
      </div>
      <nav aria-label={text.categoriesNav} className={styles.nav}>
        <NavLinkList links={categoryLinks} variant="header" />
      </nav>
    </header>
  );
}
