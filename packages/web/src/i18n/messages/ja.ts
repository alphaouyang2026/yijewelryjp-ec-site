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
  localeSwitcher: {
    nav: '言語',
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
    copyrightSign: '©',
    pricesIncludeTax: '表示価格はすべて税込です',
  },
  price: {
    taxIncluded: '（税込）',
    /** A product whose sizes cost different amounts: its lowest price, marked as a starting price. */
    from: (amount: string) => `${amount}〜`,
  },
  stockStatus: {
    in_stock: '在庫あり',
    low_stock: '残りわずか',
    sold_out: 'SOLD OUT',
  },
  productDetails: {
    materials: '素材',
    dimensions: '寸法',
    weight: '重量',
    care: 'お手入れ',
    sizes: 'サイズ',
    price: '価格',
  },
  home: {
    heroLabel: 'New Collection',
    heroMessage: '[ブランドメッセージ]',
    heroIntro: '[コレクションの紹介文：素材やデザインのこだわりを2〜3行で]',
    heroCta: 'コレクションを見る',
    newArrivalsLabel: 'New Arrivals',
    newArrivalsTitle: '新作',
    noNewArrivals: 'ただいま新作を準備中です。',
    allNewArrivals: 'すべての新作を見る',
    featuredLabel: 'Pick Up',
    featuredCta: '詳しく見る',
    categoriesLabel: 'Category',
    categoriesTitle: 'カテゴリーから探す',
    shippingTitle: '配送について',
    shippingText: '国内送料 ¥[送料]。¥[金額]以上のご購入で送料無料。',
    paymentTitle: '安心のお支払い',
    paymentText: 'クレジットカード・Apple Pay・Google Pay に対応。カード情報は当店のサーバーを通りません。',
    contactTitle: 'お問い合わせ',
    contactText: 'サイズやお手入れのご相談は [メールアドレス] まで。',
  },
  productList: {
    allLabel: 'All Items',
    allTitle: 'すべての商品',
    categoryLabel: 'Category',
    sortNav: '並び替え',
    sort: {
      newest: '新着順',
      price_asc: '価格の安い順',
      price_desc: '価格の高い順',
    },
    empty: 'この条件に合う商品はまだありません。',
  },
  productPage: {
    sizeChoice: 'サイズを選択',
  },
  notFound: {
    title: 'ページが見つかりません',
    text: 'お探しのページは、移動または削除された可能性があります。',
    home: 'トップページへ戻る',
  },
  error: {
    title: 'ページを表示できませんでした',
    text: '時間をおいて、もう一度お試しください。',
    home: 'トップページへ戻る',
  },
  admin: {
    label: 'Admin',
    title: '管理画面',
    nav: '管理メニュー',
    sections: {
      products: '商品',
      categories: 'カテゴリー',
      orders: '注文',
      settings: 'ショップ設定',
    },
    welcome: 'メニューから管理する項目を選んでください。',
    comingSoon: 'この画面は準備中です。',
    signedInAs: 'ログイン中',
    signOut: 'ログアウト',
  },
};

export type Messages = typeof ja;
