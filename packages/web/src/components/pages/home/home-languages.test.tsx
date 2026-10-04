import { screen, within } from '@testing-library/react';
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

test.each(interfaceText)('$path shows the home page in its language', async (text) => {
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
