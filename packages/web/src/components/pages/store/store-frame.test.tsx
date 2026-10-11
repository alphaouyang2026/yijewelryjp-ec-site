import { screen, within } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { emptyCart, emptyHomeData, mockApi } from '../../../test/api-mocks';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';

beforeEach(() => {
  server.use(mockApi.home(emptyHomeData));
});

test('the header shows how many the cart holds, and asks for the cart in the page’s locale', async () => {
  const requests: URL[] = [];
  server.use(mockApi.cart({ ...emptyCart, quantity: 3 }, requests));

  renderRoute('/');

  const header = await screen.findByRole('banner');
  const cart = within(header).getByRole('link', { name: 'カート（3点）' });
  expect(cart).toHaveAttribute('href', '/cart');
  expect(cart).toHaveTextContent('3');
  expect(requests.map((url) => url.searchParams.get('locale'))).toEqual(['ja']);
});

test.each([
  { path: '/zh/', name: '购物车（1件）', locale: 'zh', quantity: 1 },
  { path: '/en/', name: 'Cart (1 item)', locale: 'en', quantity: 1 },
  { path: '/en/', name: 'Cart (4 items)', locale: 'en', quantity: 4 },
])('$path: the header names the cart with its count as “$name”', async ({ path, name, locale, quantity }) => {
  const requests: URL[] = [];
  server.use(mockApi.cart({ ...emptyCart, quantity }, requests));

  renderRoute(path);

  const header = await screen.findByRole('banner');
  expect(within(header).getByRole('link', { name })).toHaveTextContent(String(quantity));
  expect(requests.map((url) => url.searchParams.get('locale'))).toEqual([locale]);
});

test('an empty cart shows no count', async () => {
  renderRoute('/');

  const cart = within(await screen.findByRole('banner')).getByRole('link', { name: 'カート' });
  expect(cart.textContent).toBe('');
});

test('when the cart cannot be read, the store still shows, with the cart link but no count', async () => {
  server.use(mockApi.cartFails());

  renderRoute('/');

  expect(await screen.findByRole('region', { name: '新作' })).toBeInTheDocument();
  const cart = within(screen.getByRole('banner')).getByRole('link', { name: 'カート' });
  expect(cart.textContent).toBe('');
});

test('pages that show an error keep the cart’s count in the header', async () => {
  server.use(mockApi.cart({ ...emptyCart, quantity: 2 }), mockApi.productPages({}));

  renderRoute('/products/no-such-ring');

  expect(await screen.findByRole('heading', { level: 1, name: 'ページが見つかりません' })).toBeInTheDocument();
  expect(within(screen.getByRole('banner')).getByRole('link', { name: 'カート（2点）' })).toBeInTheDocument();
});
