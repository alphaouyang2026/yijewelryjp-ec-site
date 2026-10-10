import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { browser } from '../../../browser';
import { mockApi, ownerSession } from '../../../test/api-mocks';
import { linkHrefs, linkTexts } from '../../../test/queries';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';

/** Records where the page sends the browser away to (outside the React app), instead of going there. */
function watchBrowserLeaving() {
  return vi.spyOn(browser, 'leaveFor').mockImplementation(() => {});
}

afterEach(() => {
  vi.restoreAllMocks();
});

test('a visitor who has not signed in is taken to sign in, to come back to the admin page they asked for', async () => {
  server.use(mockApi.adminSession(null));
  const leaveFor = watchBrowserLeaving();

  renderRoute('/zh/admin/orders?status=paid');

  await waitFor(() => expect(leaveFor).toHaveBeenCalledOnce());
  const signIn = new URL(leaveFor.mock.calls[0]?.[0] ?? '', 'https://shop.test');
  expect(signIn.pathname).toBe('/api/admin/auth/sign-in');
  expect(Object.fromEntries(signIn.searchParams)).toEqual({ locale: 'zh', returnTo: '/zh/admin/orders?status=paid' });
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

test('a signed-in owner sees the admin’s navigation, who is signed in, and a way to sign out', async () => {
  server.use(mockApi.adminSession(ownerSession));

  renderRoute('/admin');

  const nav = await screen.findByRole('navigation', { name: '管理メニュー' });
  expect(linkTexts(nav)).toEqual(['商品', 'カテゴリー', '注文', 'ショップ設定']);
  expect(linkHrefs(nav)).toEqual(['/admin/products', '/admin/categories', '/admin/orders', '/admin/settings']);
  expect(screen.getByText('owner@yijewelry.test')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument();
});

test('admin sections not built yet show a placeholder, and the navigation marks the current one', async () => {
  server.use(mockApi.adminSession(ownerSession));
  const user = userEvent.setup();
  renderRoute('/admin');
  const nav = await screen.findByRole('navigation', { name: '管理メニュー' });

  await user.click(within(nav).getByRole('link', { name: '注文' }));

  expect(await screen.findByRole('heading', { level: 1, name: '注文' })).toBeInTheDocument();
  expect(screen.getByText('この画面は準備中です。')).toBeInTheDocument();
  expect(within(nav).getByRole('link', { name: '注文' })).toHaveAttribute('aria-current', 'page');
  expect(within(nav).getByRole('link', { name: '商品' })).not.toHaveAttribute('aria-current');
});

test.each([
  {
    path: '/zh/admin/products',
    lang: 'zh-Hans',
    nav: '后台菜单',
    links: ['商品', '类别', '订单', '店铺设置'],
    hrefs: ['/zh/admin/products', '/zh/admin/categories', '/zh/admin/orders', '/zh/admin/settings'],
    heading: '商品',
    comingSoon: '此页面正在准备中。',
    signOut: '退出登录',
  },
  {
    path: '/en/admin/products',
    lang: 'en',
    nav: 'Admin menu',
    links: ['Products', 'Categories', 'Orders', 'Store settings'],
    hrefs: ['/en/admin/products', '/en/admin/categories', '/en/admin/orders', '/en/admin/settings'],
    heading: 'Products',
    comingSoon: 'This page is coming soon.',
    signOut: 'Sign out',
  },
])('$path shows the admin in its locale', async (text) => {
  server.use(mockApi.adminSession(ownerSession));

  renderRoute(text.path);

  const nav = await screen.findByRole('navigation', { name: text.nav });
  expect(linkTexts(nav)).toEqual(text.links);
  expect(linkHrefs(nav)).toEqual(text.hrefs);
  expect(await screen.findByRole('heading', { level: 1, name: text.heading })).toBeInTheDocument();
  expect(screen.getByText(text.comingSoon)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: text.signOut })).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute('lang', text.lang);
});

test('switching the locale in the admin stays on the same admin page', async () => {
  server.use(mockApi.adminSession(ownerSession));
  const user = userEvent.setup();
  renderRoute('/admin/orders');
  const switcher = await screen.findByRole('navigation', { name: '言語' });

  await user.click(within(switcher).getByRole('link', { name: 'English' }));

  expect(await screen.findByRole('heading', { level: 1, name: 'Orders' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Admin menu' })).toBeInTheDocument();
});

test('signing out ends the session at the API, with the session’s CSRF token, then leaves for the provider’s sign-out', async () => {
  const requests: Request[] = [];
  server.use(
    mockApi.adminSession(ownerSession),
    mockApi.adminSignOut({ signOutUrl: 'https://identity.test/logout?lang=zh' }, requests),
  );
  const leaveFor = watchBrowserLeaving();
  const user = userEvent.setup();
  renderRoute('/zh/admin');

  await user.click(await screen.findByRole('button', { name: '退出登录' }));

  await waitFor(() => expect(leaveFor).toHaveBeenCalledWith('https://identity.test/logout?lang=zh'));
  expect(requests).toHaveLength(1);
  expect(new URL(requests[0]?.url ?? '').searchParams.get('locale')).toBe('zh');
  expect(requests[0]?.headers.get('X-CSRF-Token')).toBe(ownerSession.csrfToken);
});

test('signing out after the session already ended goes to the store’s home page', async () => {
  server.use(mockApi.adminSession(ownerSession), mockApi.adminSignOut(null));
  const leaveFor = watchBrowserLeaving();
  const user = userEvent.setup();
  renderRoute('/en/admin');

  await user.click(await screen.findByRole('button', { name: 'Sign out' }));

  await waitFor(() => expect(leaveFor).toHaveBeenCalledWith('/en/'));
});

test.each([
  {
    path: '/admin/sign-in-failed',
    heading: 'ログインできませんでした',
    retry: 'もう一度ログインする',
    admin: '/admin',
    signIn: { locale: 'ja', returnTo: '/admin' },
  },
  {
    path: '/zh/admin/sign-in-failed',
    heading: '登录未成功',
    retry: '重新登录',
    admin: '/zh/admin',
    signIn: { locale: 'zh', returnTo: '/zh/admin' },
  },
])('$path says that signing in failed, without a session, and the owner can try again', async (text) => {
  server.use(mockApi.adminSession(null));
  const leaveFor = watchBrowserLeaving();
  const user = userEvent.setup();

  renderRoute(text.path);

  expect(await screen.findByRole('heading', { level: 1, name: text.heading })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: /管理メニュー|后台菜单/ })).not.toBeInTheDocument();
  expect(leaveFor).not.toHaveBeenCalled();
  const retry = screen.getByRole('link', { name: text.retry });
  expect(retry).toHaveAttribute('href', text.admin);

  await user.click(retry);

  await waitFor(() => expect(leaveFor).toHaveBeenCalledOnce());
  const signIn = new URL(leaveFor.mock.calls[0]?.[0] ?? '', 'https://shop.test');
  expect(signIn.pathname).toBe('/api/admin/auth/sign-in');
  expect(Object.fromEntries(signIn.searchParams)).toEqual(text.signIn);
});

test.each([
  { path: '/admin/orders', heading: '管理画面を表示できませんでした', home: '管理画面のトップへ', href: '/admin' },
  { path: '/en/admin', heading: 'The admin could not be shown', home: 'Back to the admin home', href: '/en/admin' },
])('$path shows the admin’s own error page when the admin cannot be shown', async (text) => {
  server.use(mockApi.adminSessionFails());

  renderRoute(text.path);

  expect(await screen.findByRole('heading', { level: 1, name: text.heading })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: text.home })).toHaveAttribute('href', text.href);
  expect(screen.getByText('Admin')).toBeInTheDocument();
  // Not the storefront's frame: no store header or footer.
  expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
});
