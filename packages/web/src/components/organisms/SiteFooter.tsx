import type { Category } from '../../api';
import { BRAND_NAME } from '../../brand';
import { useMessages } from '../../i18n/useMessages';
import { paths } from '../../paths';
import { Label } from '../atoms/Label';
import { Logo } from '../atoms/Logo';
import { NavLinkList } from '../molecules/NavLinkList';
import styles from './SiteFooter.module.css';
import { useCategoryLinks } from './useCategoryLinks';

export function SiteFooter({ categories }: { categories: Category[] }) {
  const text = useMessages().footer;
  const categoryLinks = useCategoryLinks(categories);
  const guideLinks = [
    { to: paths.shippingReturns, label: text.shippingReturns },
    { to: paths.tokushoho, label: text.tokushoho },
    { to: paths.privacy, label: text.privacy },
    { to: paths.terms, label: text.terms },
  ];

  return (
    <footer className={styles.footer}>
      <div className={styles.columns}>
        <div className={styles.brand}>
          <Logo alt={BRAND_NAME} size="footer" />
          <p className={styles.tagline}>{text.tagline}</p>
        </div>
        <nav aria-label={text.guideNav} className={styles.column}>
          <Label ground="dark" className={styles.columnTitle}>
            {text.guideLabel}
          </Label>
          <NavLinkList links={guideLinks} variant="footer" />
        </nav>
        <nav aria-label={text.categoriesNav} className={styles.column}>
          <Label ground="dark" className={styles.columnTitle}>
            {text.categoriesLabel}
          </Label>
          <NavLinkList links={categoryLinks} variant="footer" />
        </nav>
        <div className={styles.column}>
          <Label ground="dark" className={styles.columnTitle}>
            {text.contactLabel}
          </Label>
          {/* The contact address comes from the store settings once they exist. */}
          <p className={styles.contact}>{text.contactEmail}</p>
        </div>
      </div>
      <div className={styles.bottomWrap}>
        <div className={styles.bottom}>
          <span>© {BRAND_NAME}</span>
          <span>{text.pricesIncludeTax}</span>
        </div>
      </div>
    </footer>
  );
}
