import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';
import { emptyHomeData, mockApi } from '../../../test/api-mocks';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';

beforeEach(() => {
  server.use(mockApi.home(emptyHomeData));
});

const interfaceText = [
  {
    path: '/',
    lang: 'ja',
    announcement: '¥[金額]以上のご購入で、国内送料無料',
    categoriesNav: 'カテゴリー',
    newArrivalsLink: '新作',
    cart: 'カート',
    guideNav: 'ショッピングガイド',
    guideLinks: ['配送・返品について', '特定商取引法に基づく表記', 'プライバシーポリシー', '利用規約'],
    contact: '[メールアドレス]',
    newArrivalsSection: '新作',
    noNewArrivals: 'ただいま新作を準備中です。',
  },
  {
    path: '/zh/',
    lang: 'zh-Hans',
    announcement: '订单满¥[金额]即享日本国内免运费',
    categoriesNav: '商品分类',
    newArrivalsLink: '新品',
    cart: '购物车',
    guideNav: '购物指南',
    guideLinks: ['配送与退换货', '基于《特定商业交易法》的标示', '隐私政策', '使用条款'],
    contact: '[邮箱地址]',
    newArrivalsSection: '新品',
    noNewArrivals: '新品正在筹备中，敬请期待。',
  },
  {
    path: '/en/',
    lang: 'en',
    announcement: 'Free shipping within Japan on orders of ¥[amount] or more',
    categoriesNav: 'Categories',
    newArrivalsLink: 'New Arrivals',
    cart: 'Cart',
    guideNav: 'Shopping guide',
    guideLinks: [
      'Shipping & Returns',
      'Notice under the Act on Specified Commercial Transactions',
      'Privacy Policy',
      'Terms of Use',
    ],
    contact: '[email address]',
    newArrivalsSection: 'New Arrivals',
    noNewArrivals: 'New pieces are coming soon.',
  },
];

test.each(interfaceText)('$path shows the home page in its locale', async (text) => {
  renderRoute(text.path);

  const newArrivals = await screen.findByRole('region', { name: text.newArrivalsSection });
  expect(within(newArrivals).getByText(text.noNewArrivals)).toBeInTheDocument();
  expect(screen.getByText(text.announcement)).toBeInTheDocument();

  const header = screen.getByRole('banner');
  const categories = within(header).getByRole('navigation', { name: text.categoriesNav });
  expect(within(categories).getByRole('link', { name: text.newArrivalsLink })).toBeInTheDocument();
  expect(within(header).getByRole('link', { name: text.cart })).toBeInTheDocument();

  const footer = screen.getByRole('contentinfo');
  const guide = within(footer).getByRole('navigation', { name: text.guideNav });
  expect(within(guide).getAllByRole('link').map((link) => link.textContent)).toEqual(text.guideLinks);
  expect(within(footer).getByText(text.contact)).toBeInTheDocument();

  expect(document.documentElement).toHaveAttribute('lang', text.lang);
});

test('links on a /zh/ page stay in Chinese', async () => {
  server.use(mockApi.home({ ...emptyHomeData, categories: [{ slug: 'ring', name: '戒指' }] }));

  renderRoute('/zh/');

  const header = await screen.findByRole('banner');
  expect(within(header).getByRole('link', { name: 'Y&I Jewelry' })).toHaveAttribute('href', '/zh/');
  expect(within(header).getByRole('link', { name: '购物车' })).toHaveAttribute('href', '/zh/cart');
  const categories = within(header).getByRole('navigation', { name: '商品分类' });
  expect(hrefs(categories)).toEqual(['/zh/products', '/zh/categories/ring']);

  const footer = screen.getByRole('contentinfo');
  expect(hrefs(within(footer).getByRole('navigation', { name: '购物指南' }))).toEqual([
    '/zh/shipping-returns',
    '/zh/tokushoho',
    '/zh/privacy',
    '/zh/terms',
  ]);
  expect(hrefs(within(footer).getByRole('navigation', { name: '商品分类（页脚）' }))).toEqual([
    '/zh/products',
    '/zh/categories/ring',
  ]);
});

test('the home page asks the API for its data in the page’s locale', async () => {
  server.use(
    mockApi.homeByLocale({
      ja: { ...emptyHomeData, categories: [{ slug: 'ring', name: 'リング' }] },
      zh: { ...emptyHomeData, categories: [{ slug: 'ring', name: '戒指' }] },
      en: { ...emptyHomeData, categories: [{ slug: 'ring', name: 'Rings' }] },
    }),
  );

  renderRoute('/en/');

  const categories = await screen.findByRole('navigation', { name: 'Categories' });
  expect(within(categories).getAllByRole('link').map((link) => link.textContent)).toEqual(['New Arrivals', 'Rings']);
});

test('the header’s locale switcher links to this page in each locale and marks the current one', async () => {
  renderRoute('/en/?utm_source=line');

  const header = await screen.findByRole('banner');
  const switcher = within(header).getByRole('navigation', { name: 'Language' });
  expect(within(switcher).getByRole('link', { name: '日本語' })).toHaveAttribute('href', '/?utm_source=line');
  expect(within(switcher).getByRole('link', { name: '中文' })).toHaveAttribute('href', '/zh/?utm_source=line');
  const english = within(switcher).getByRole('link', { name: 'English' });
  expect(english).toHaveAttribute('href', '/en/?utm_source=line');
  expect(english).toHaveAttribute('aria-current', 'page');
});

test('switching the locale stays on the same page', async () => {
  const user = userEvent.setup();
  renderRoute('/zh/');
  const switcher = within(await screen.findByRole('banner')).getByRole('navigation', { name: '语言' });

  await user.click(within(switcher).getByRole('link', { name: 'English' }));

  const newArrivals = await screen.findByRole('region', { name: 'New Arrivals' });
  expect(within(newArrivals).getByText('New pieces are coming soon.')).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute('lang', 'en');
});

function hrefs(container: HTMLElement) {
  return within(container)
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'));
}
