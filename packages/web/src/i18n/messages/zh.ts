import type { Messages } from './ja';

/** The interface text in Simplified Chinese. */
export const zh: Messages = {
  announcement: {
    freeShipping: '订单满¥[金额]即享日本国内免运费',
  },
  header: {
    categoriesNav: '商品分类',
    cart: '购物车',
  },
  localeSwitcher: {
    nav: '语言',
  },
  categoryNav: {
    newArrivals: '新品',
  },
  footer: {
    tagline: '[品牌一句话介绍]',
    guideNav: '购物指南',
    guideLabel: 'GUIDE',
    shippingReturns: '配送与退换货',
    tokushoho: '基于《特定商业交易法》的标示',
    privacy: '隐私政策',
    terms: '使用条款',
    categoriesNav: '商品分类（页脚）',
    categoriesLabel: 'CATEGORY',
    contactLabel: 'CONTACT',
    contactEmail: '[邮箱地址]',
    copyrightSign: '©',
    pricesIncludeTax: '所示价格均为含税价格',
  },
  price: {
    taxIncluded: '（含税）',
    from: (amount) => `${amount}起`,
  },
  stockStatus: {
    in_stock: '现货',
    low_stock: '仅剩少量',
    sold_out: 'SOLD OUT',
  },
  productDetails: {
    materials: '材质',
    dimensions: '尺寸',
    weight: '重量',
    care: '保养方法',
    sizes: '尺码',
    price: '价格',
  },
  home: {
    heroLabel: 'New Collection',
    heroMessage: '[品牌宣言]',
    heroIntro: '[系列介绍：用两三句话介绍材质与设计理念]',
    heroCta: '浏览系列',
    newArrivalsLabel: 'New Arrivals',
    newArrivalsTitle: '新品',
    noNewArrivals: '新品正在筹备中，敬请期待。',
    allNewArrivals: '查看全部新品',
    featuredLabel: 'Pick Up',
    featuredCta: '查看详情',
    categoriesLabel: 'Category',
    categoriesTitle: '按分类浏览',
    shippingTitle: '配送说明',
    shippingText: '日本国内运费 ¥[运费]。订单满¥[金额]免运费。',
    paymentTitle: '安心支付',
    paymentText: '支持信用卡、Apple Pay、Google Pay。银行卡信息不会经过本店服务器。',
    contactTitle: '联系我们',
    contactText: '尺码及保养相关问题，请发送邮件至 [邮箱地址]。',
  },
  productList: {
    allLabel: 'All Items',
    allTitle: '全部商品',
    categoryLabel: 'Category',
    sortNav: '排序',
    sort: {
      newest: '最新上架',
      price_asc: '价格从低到高',
      price_desc: '价格从高到低',
    },
    empty: '暂无符合条件的商品。',
  },
  productPage: {
    sizeChoice: '选择尺码',
  },
  notFound: {
    title: '页面不存在',
    text: '您要找的页面可能已被移动或删除。',
    home: '返回首页',
  },
  error: {
    title: '页面暂时无法显示',
    text: '请稍后再试。',
    home: '返回首页',
  },
};
