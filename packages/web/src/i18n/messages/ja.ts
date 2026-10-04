/**
 * The interface text in Japanese, the default locale. Its shape is `Messages`:
 * zh.ts and en.ts must have exactly the same keys, or type checking fails.
 *
 * `…Label` entries are the design's English labels, which stay in English in
 * every locale. Bracketed text is a placeholder for facts the store settings
 * will supply.
 */
export const ja = {
  announcement: {
    freeShipping: '¥[金額]以上のご購入で、国内送料無料',
  },
  header: {
    categoriesNav: 'カテゴリー',
    cart: 'カート',
  },
  categoryNav: {
    newArrivals: '新作',
  },
  footer: {
    tagline: '[ブランドの一言紹介]',
    guideNav: 'ショッピングガイド',
    guideLabel: 'GUIDE',
    shippingReturns: '配送・返品について',
    tokushoho: '特定商取引法に基づく表記',
    privacy: 'プライバシーポリシー',
    terms: '利用規約',
    categoriesNav: 'カテゴリー（フッター）',
    categoriesLabel: 'CATEGORY',
    contactLabel: 'CONTACT',
    contactEmail: '[メールアドレス]',
    pricesIncludeTax: '表示価格はすべて税込です',
  },
  home: {
    newArrivalsLabel: 'New Arrivals',
    newArrivalsTitle: '新作',
    noNewArrivals: 'ただいま新作を準備中です。',
  },
};

export type Messages = typeof ja;
