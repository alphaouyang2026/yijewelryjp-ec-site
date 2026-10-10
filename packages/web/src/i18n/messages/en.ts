import type { Messages } from './ja';

/** The interface text in English. */
export const en: Messages = {
  announcement: {
    freeShipping: 'Free shipping within Japan on orders of ¥[amount] or more',
  },
  header: {
    categoriesNav: 'Categories',
    cart: 'Cart',
  },
  localeSwitcher: {
    nav: 'Language',
  },
  categoryNav: {
    newArrivals: 'New Arrivals',
  },
  footer: {
    tagline: '[Brand tagline]',
    guideNav: 'Shopping guide',
    guideLabel: 'GUIDE',
    shippingReturns: 'Shipping & Returns',
    tokushoho: 'Notice under the Act on Specified Commercial Transactions',
    privacy: 'Privacy Policy',
    terms: 'Terms of Use',
    categoriesNav: 'Categories (footer)',
    categoriesLabel: 'CATEGORY',
    contactLabel: 'CONTACT',
    contactEmail: '[email address]',
    copyrightSign: '©',
    pricesIncludeTax: 'All prices include tax',
  },
  price: {
    taxIncluded: '(tax incl.)',
    from: (amount) => `from ${amount}`,
  },
  stockStatus: {
    in_stock: 'In stock',
    low_stock: 'Only a few left',
    sold_out: 'SOLD OUT',
  },
  productDetails: {
    materials: 'Materials',
    dimensions: 'Dimensions',
    weight: 'Weight',
    care: 'Care',
    sizes: 'Sizes',
    price: 'Price',
  },
  home: {
    heroLabel: 'New Collection',
    heroMessage: '[Brand message]',
    heroIntro: '[Collection introduction: two or three lines on the materials and design]',
    heroCta: 'View the collection',
    newArrivalsLabel: 'New Arrivals',
    newArrivalsTitle: 'New Arrivals',
    noNewArrivals: 'New pieces are coming soon.',
    allNewArrivals: 'See all new arrivals',
    featuredLabel: 'Pick Up',
    featuredCta: 'View details',
    categoriesLabel: 'Category',
    categoriesTitle: 'Shop by category',
    shippingTitle: 'Shipping',
    shippingText: 'Shipping within Japan: ¥[shipping fee]. Free on orders of ¥[amount] or more.',
    paymentTitle: 'Secure payment',
    paymentText: 'Credit cards, Apple Pay and Google Pay. Card details never pass through our servers.',
    contactTitle: 'Contact',
    contactText: 'Questions about sizes or care? Email us at [email address].',
  },
  productList: {
    allLabel: 'All Items',
    allTitle: 'All products',
    categoryLabel: 'Category',
    sortNav: 'Sort',
    sort: {
      newest: 'Newest',
      price_asc: 'Price: low to high',
      price_desc: 'Price: high to low',
    },
    empty: 'No products here yet.',
  },
  productPage: {
    sizeChoice: 'Choose a size',
  },
  notFound: {
    title: 'Page not found',
    text: 'The page you are looking for may have moved or been removed.',
    home: 'Back to the home page',
  },
  error: {
    title: 'This page could not be shown',
    text: 'Please try again in a moment.',
    home: 'Back to the home page',
  },
};
