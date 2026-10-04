import type { Category } from '../../api';
import { BRAND_NAME } from '../../brand';
import { paths } from '../../paths';
import { Label } from '../atoms/Label';
import { Logo } from '../atoms/Logo';
import { NavLinkList, type NavLinkItem } from '../molecules/NavLinkList';
import { categoryLinks } from './categoryLinks';
import styles from './SiteFooter.module.css';

const guideLinks: NavLinkItem[] = [
  { to: paths.shippingReturns, label: '配送・返品について' },
  { to: paths.tokushoho, label: '特定商取引法に基づく表記' },
  { to: paths.privacy, label: 'プライバシーポリシー' },
  { to: paths.terms, label: '利用規約' },
];

export function SiteFooter({ categories }: { categories: Category[] }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.columns}>
        <div className={styles.brand}>
          <Logo alt={BRAND_NAME} size="footer" />
          <p className={styles.tagline}>[ブランドの一言紹介]</p>
        </div>
        <nav aria-label="ショッピングガイド" className={styles.column}>
          <Label ground="dark" className={styles.columnTitle}>
            GUIDE
          </Label>
          <NavLinkList links={guideLinks} variant="footer" />
        </nav>
        <nav aria-label="カテゴリー（フッター）" className={styles.column}>
          <Label ground="dark" className={styles.columnTitle}>
            CATEGORY
          </Label>
          <NavLinkList links={categoryLinks(categories)} variant="footer" />
        </nav>
        <div className={styles.column}>
          <Label ground="dark" className={styles.columnTitle}>
            CONTACT
          </Label>
          {/* The contact address comes from the store settings once they exist. */}
          <p className={styles.contact}>[メールアドレス]</p>
        </div>
      </div>
      <div className={styles.bottomWrap}>
        <div className={styles.bottom}>
          <span>© {BRAND_NAME}</span>
          <span>表示価格はすべて税込です</span>
        </div>
      </div>
    </footer>
  );
}
