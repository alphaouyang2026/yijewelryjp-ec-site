import { Link } from 'react-router';
import type { Category } from '../api';
import { BRAND_NAME, logoUrl } from '../brand';
import { categoryLinks } from './categoryLinks';
import styles from './SiteFooter.module.css';

const guideLinks = [
  { to: '/shipping-returns', label: '配送・返品について' },
  { to: '/tokushoho', label: '特定商取引法に基づく表記' },
  { to: '/privacy', label: 'プライバシーポリシー' },
  { to: '/terms', label: '利用規約' },
];

export function SiteFooter({ categories }: { categories: Category[] }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.columns}>
        <div className={styles.brand}>
          <img src={logoUrl} alt={BRAND_NAME} width={96} height={96} className={styles.logo} />
          <p className={styles.tagline}>[ブランドの一言紹介]</p>
        </div>
        <nav aria-label="ショッピングガイド" className={styles.column}>
          <p className={styles.columnTitle}>GUIDE</p>
          {guideLinks.map((link) => (
            <Link key={link.to} to={link.to} className={styles.link}>
              {link.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="カテゴリー（フッター）" className={styles.column}>
          <p className={styles.columnTitle}>CATEGORY</p>
          {categoryLinks(categories).map((link) => (
            <Link key={link.to} to={link.to} className={styles.link}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className={styles.column}>
          <p className={styles.columnTitle}>CONTACT</p>
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
