import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';
import type { ProductPage } from '../../../api';
import { emptyHomeData, mockApi } from '../../../test/api-mocks';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';

const categories = [{ slug: 'rings', name: 'リング' }];

const crescentRing: ProductPage = {
  product: {
    slug: 'crescent-ring',
    name: '三日月のリング',
    description: '細い三日月をかたどったリングです。',
    materials: 'K18イエローゴールド',
    dimensions: '幅 約2mm',
    weight: null,
    care: '着用後は柔らかい布で拭いてください。',
    photos: [],
    category: { slug: 'rings', name: 'リング' },
    stockStatus: 'in_stock',
    variants: [
      { sku: '7', label: '7号', priceYen: 24_000, stockStatus: 'in_stock' },
      { sku: '9', label: '9号', priceYen: 24_000, stockStatus: 'low_stock' },
      { sku: '11', label: '11号', priceYen: 25_000, stockStatus: 'in_stock' },
      { sku: '13', label: '13号', priceYen: 25_000, stockStatus: 'sold_out' },
    ],
  },
  categories,
};

const front = { url: '/images/products/front.jpg', alt: '正面から見た三日月のリング' };
const side = { url: '/images/products/side.jpg', alt: '横から見た三日月のリング' };
const worn = { url: '/images/products/worn.jpg', alt: '指につけた三日月のリング' };

const photographedRing: ProductPage = {
  product: { ...crescentRing.product, slug: 'photographed-ring', photos: [front, side, worn] },
  categories,
};

const onePhotoRing: ProductPage = {
  product: { ...crescentRing.product, slug: 'one-photo-ring', photos: [front] },
  categories,
};

const soldOutEarrings: ProductPage = {
  product: {
    ...crescentRing.product,
    slug: 'pearl-earrings',
    name: 'パールピアス',
    stockStatus: 'sold_out',
    variants: [{ sku: 'one', label: 'フリー', priceYen: 28_000, stockStatus: 'sold_out' }],
  },
  categories,
};

beforeEach(() => {
  server.use(
    mockApi.productPages({
      'crescent-ring': crescentRing,
      'pearl-earrings': soldOutEarrings,
      'photographed-ring': photographedRing,
      'one-photo-ring': onePhotoRing,
    }),
    mockApi.home(emptyHomeData),
  );
});

test('shows the product with its details and the price in yen, tax included', async () => {
  renderRoute('/products/crescent-ring');

  const main = await screen.findByRole('main');
  expect(within(main).getByRole('heading', { level: 1, name: '三日月のリング' })).toBeInTheDocument();
  expect(within(main).getByText('¥24,000').parentElement).toHaveTextContent('¥24,000（税込）');
  expect(within(main).getByText('細い三日月をかたどったリングです。')).toBeInTheDocument();
  expect(within(main).getByText('素材').nextElementSibling).toHaveTextContent('K18イエローゴールド');
  expect(within(main).getByText('寸法').nextElementSibling).toHaveTextContent('幅 約2mm');
  // The owner left the weight out, so it is not listed.
  expect(within(main).queryByText('重量')).not.toBeInTheDocument();
  expect(within(main).getByRole('link', { name: 'リング' })).toHaveAttribute('href', '/categories/rings');
});

test('the gallery shows the first photo large, and pressing a thumbnail shows that photo instead', async () => {
  const user = userEvent.setup();
  renderRoute('/products/photographed-ring');

  const thumbnails = await screen.findByRole('list', { name: '商品写真' });
  const large = () => {
    const shown = within(screen.getByRole('main'))
      .getAllByRole('img')
      .filter((img) => !thumbnails.contains(img));
    expect(shown).toHaveLength(1);
    return shown[0];
  };
  const buttons = within(thumbnails).getAllByRole('button');
  expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
  expect(large()).toHaveAttribute('src', front.url);
  expect(large()).toHaveAccessibleName(front.alt);

  await user.click(within(thumbnails).getByRole('button', { name: worn.alt }));

  expect(large()).toHaveAttribute('src', worn.url);
  expect(large()).toHaveAccessibleName(worn.alt);
  expect(within(thumbnails).getByRole('button', { name: worn.alt })).toHaveAttribute('aria-pressed', 'true');
  expect(within(thumbnails).getByRole('button', { name: front.alt })).toHaveAttribute('aria-pressed', 'false');
});

test('every photo on the page says what it shows', async () => {
  renderRoute('/products/photographed-ring');

  const main = await screen.findByRole('main');
  await within(main).findByRole('list', { name: '商品写真' });
  const images = within(main).getAllByRole('img');
  expect(images).toHaveLength(4);
  for (const image of images) expect(image.getAttribute('alt')).toMatch(/\S/);
});

test('a product with one photo shows it with no thumbnails; one without photos shows the photo’s place', async () => {
  const { unmount } = renderRoute('/products/one-photo-ring');

  const main = await screen.findByRole('main');
  expect(within(main).getByRole('img', { name: front.alt })).toHaveAttribute('src', front.url);
  expect(within(main).queryByRole('list', { name: '商品写真' })).not.toBeInTheDocument();
  unmount();

  renderRoute('/products/crescent-ring');
  const bare = await screen.findByRole('main');
  await within(bare).findByRole('heading', { level: 1, name: '三日月のリング' });
  expect(within(bare).queryByRole('img')).not.toBeInTheDocument();
});

test('a sold-out size cannot be chosen; choosing another size shows its price and stock', async () => {
  const user = userEvent.setup();
  renderRoute('/products/crescent-ring');

  const sizes = await screen.findByRole('radiogroup', { name: 'サイズを選択' });
  expect(within(sizes).getByRole('radio', { name: '7号' })).toBeChecked();
  expect(within(sizes).getByRole('radio', { name: '13号' })).toBeDisabled();

  await user.click(within(sizes).getByRole('radio', { name: '11号' }));
  expect(screen.getByText('¥25,000')).toBeInTheDocument();
  expect(screen.getByText('在庫あり')).toBeInTheDocument();

  await user.click(within(sizes).getByRole('radio', { name: '9号' }));
  expect(screen.getByText('¥24,000')).toBeInTheDocument();
  expect(screen.getByText('残りわずか')).toBeInTheDocument();
});

test('a product whose every size is sold out can still be viewed, shows SOLD OUT and offers no size', async () => {
  renderRoute('/products/pearl-earrings');

  const main = await screen.findByRole('main');
  expect(within(main).getByRole('heading', { level: 1, name: 'パールピアス' })).toBeInTheDocument();
  expect(within(main).getByText('SOLD OUT')).toBeInTheDocument();
  const sizes = within(main).getByRole('radiogroup', { name: 'サイズを選択' });
  for (const size of within(sizes).getAllByRole('radio')) {
    expect(size).toBeDisabled();
    expect(size).not.toBeChecked();
  }
});

test('in Chinese, the price says tax included in Chinese and links stay in Chinese', async () => {
  renderRoute('/zh/products/crescent-ring');

  const main = await screen.findByRole('main');
  expect(within(main).getByText('¥24,000').parentElement).toHaveTextContent('¥24,000（含税）');
  expect(within(main).getByRole('link', { name: 'リング' })).toHaveAttribute('href', '/zh/categories/rings');
  expect(document.documentElement).toHaveAttribute('lang', 'zh-Hans');
});

test('a product the API does not know shows the not-found page', async () => {
  renderRoute('/products/no-such-ring');

  expect(await screen.findByRole('heading', { level: 1, name: 'ページが見つかりません' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'トップページへ戻る' })).toHaveAttribute('href', '/');
});

test('a URL the site does not have shows the not-found page, in the URL’s locale', async () => {
  renderRoute('/en/no/such/page');

  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to the home page' })).toHaveAttribute('href', '/en/');
});
