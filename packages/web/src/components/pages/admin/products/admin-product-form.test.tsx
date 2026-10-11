import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';
import type { AdminCategoryList, AdminProduct } from '../../../../api';
import { mockApi, ownerSession } from '../../../../test/api-mocks';
import { renderRoute } from '../../../../test/render';
import { server } from '../../../../test/server';

const categories: AdminCategoryList = {
  categories: [
    { slug: 'rings', displayName: 'リング', name: { ja: 'リング', en: 'Rings' }, version: 1 },
    { slug: 'necklaces', displayName: 'ネックレス', name: { ja: 'ネックレス' }, version: 1 },
  ],
};

const moonRing: AdminProduct = {
  slug: 'moon-ring',
  status: 'draft',
  statusChanges: ['list', 'archive'],
  name: { ja: '月のリング', en: 'Moon Ring' },
  description: { ja: '月をかたどったリング。' },
  materials: { ja: 'K18' },
  dimensions: null,
  weight: null,
  care: null,
  categorySlug: 'rings',
  featured: false,
  listedAt: null,
  version: 3,
  variants: [
    { sku: 'moon-9', label: { ja: '9号' }, priceYen: 24_000, onHandStock: 3, reservedStock: 1 },
    { sku: 'moon-11', label: { ja: '11号' }, priceYen: 25_000, onHandStock: 0, reservedStock: 0 },
  ],
  photos: [],
};

/** The fieldset (group) of a text kept per locale, or of a variant. */
const group = (name: string, container: HTMLElement = document.body) => within(container).getByRole('group', { name });

test('the new-product form sends what the owner entered, with the CSRF token, then opens the product to edit', async () => {
  const requests: Request[] = [];
  server.use(
    mockApi.adminSession(ownerSession),
    mockApi.adminCategories(categories),
    mockApi.adminCreateProduct({ status: 201, body: { ...moonRing, version: 1 } }, requests),
    mockApi.adminProduct({ ...moonRing, version: 1 }),
  );
  const user = userEvent.setup();
  renderRoute('/admin/products/new');

  await user.type(await screen.findByRole('textbox', { name: 'スラッグ（URL）' }), 'moon-ring');
  await user.type(within(group('商品名')).getByRole('textbox', { name: '日本語（必須）' }), '月のリング');
  await user.type(within(group('商品名')).getByRole('textbox', { name: 'English' }), 'Moon Ring');
  await user.type(within(group('説明')).getByRole('textbox', { name: '日本語（必須）' }), '月をかたどったリング。');
  await user.type(within(group('素材')).getByRole('textbox', { name: '日本語' }), 'K18');
  await user.selectOptions(screen.getByRole('combobox', { name: 'カテゴリー' }), 'リング');
  await user.click(screen.getByRole('checkbox', { name: 'トップページでピックアップする' }));
  const variant = group('規格 1');
  await user.type(within(group('規格名（例：9号）', variant)).getByRole('textbox', { name: '日本語（必須）' }), '9号');
  await user.type(within(variant).getByRole('textbox', { name: 'SKU' }), 'moon-9');
  await user.type(within(variant).getByRole('spinbutton', { name: '価格（税込・円）' }), '24000');
  await user.type(within(variant).getByRole('spinbutton', { name: '在庫数' }), '3');
  await user.click(screen.getByRole('button', { name: '下書きとして作成' }));

  expect(await screen.findByRole('heading', { level: 1, name: '商品を編集' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('商品を作成しました。');
  expect(requests).toHaveLength(1);
  expect(requests[0]?.headers.get('X-CSRF-Token')).toBe(ownerSession.csrfToken);
  const blank = { ja: '', zh: '', en: '' };
  expect(await requests[0]?.json()).toEqual({
    slug: 'moon-ring',
    name: { ja: '月のリング', zh: '', en: 'Moon Ring' },
    description: { ...blank, ja: '月をかたどったリング。' },
    materials: { ...blank, ja: 'K18' },
    dimensions: blank,
    weight: blank,
    care: blank,
    categorySlug: 'rings',
    featured: true,
    variants: [{ sku: 'moon-9', label: { ...blank, ja: '9号' }, priceYen: 24_000, onHandStock: 3 }],
    photos: [],
  });
});

test('the form shows the API’s errors next to each field, in the owner’s locale', async () => {
  server.use(
    mockApi.adminSession(ownerSession),
    mockApi.adminCategories(categories),
    mockApi.adminCreateProduct({
      status: 400,
      body: {
        error: 'invalid_input',
        fields: [
          { path: 'slug', code: 'slug_taken' },
          { path: 'name.ja', code: 'required' },
          { path: 'variants.0.priceYen', code: 'non_negative_integer' },
          { path: 'variants.0.sku', code: 'sku_taken' },
        ],
      },
    }),
  );
  const user = userEvent.setup();
  renderRoute('/zh/admin/products/new');

  await user.type(await screen.findByRole('textbox', { name: 'Slug（URL）' }), 'moon-ring');
  await user.type(within(group('规格 1')).getByRole('spinbutton', { name: '价格（含税・日元）' }), '-1');
  await user.click(screen.getByRole('button', { name: '创建为草稿' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('请检查输入内容。');
  const slug = screen.getByRole('textbox', { name: 'Slug（URL）' });
  expect(slug).toBeInvalid();
  expect(slug).toHaveAccessibleDescription(expect.stringContaining('此 Slug 已被使用。'));
  const nameJa = within(group('商品名称')).getByRole('textbox', { name: '日本語（必填）' });
  expect(nameJa).toBeInvalid();
  expect(nameJa).toHaveAccessibleDescription('请填写。');
  expect(within(group('商品名称')).getByRole('textbox', { name: 'English' })).toBeValid();
  const variant = group('规格 1');
  expect(within(variant).getByRole('spinbutton', { name: '价格（含税・日元）' })).toHaveAccessibleDescription(
    '请输入 0 或以上的整数。',
  );
  expect(within(variant).getByRole('textbox', { name: 'SKU' })).toHaveAccessibleDescription('此 SKU 已被其他规格使用。');
  expect(within(variant).getByRole('spinbutton', { name: '在库数' })).toBeValid();
});

test('editing sends the changed product with the version the owner saw, keeping each variant’s SKU', async () => {
  const requests: Request[] = [];
  server.use(
    mockApi.adminSession(ownerSession),
    mockApi.adminCategories(categories),
    mockApi.adminProduct(moonRing),
    mockApi.adminEditProduct({ status: 200, body: { ...moonRing, version: 4 } }, requests),
  );
  const user = userEvent.setup();
  renderRoute('/en/admin/products/moon-ring/edit');

  const first = await screen.findByRole('group', { name: 'Variant 1' });
  expect(screen.queryByRole('textbox', { name: 'Slug (URL)' })).not.toBeInTheDocument();
  expect(screen.getByText('moon-ring')).toBeInTheDocument();
  expect(within(first).getByText('1 reserved')).toBeInTheDocument();
  const stock = within(first).getByRole('spinbutton', { name: 'On hand' });
  await user.clear(stock);
  await user.type(stock, '7');
  await user.click(screen.getByRole('button', { name: 'Remove variant 2' }));
  await user.click(screen.getByRole('button', { name: 'Add a variant' }));
  const added = screen.getByRole('group', { name: 'Variant 2' });
  await user.type(within(group('Variant name (e.g. Size 9)', added)).getByRole('textbox', { name: '日本語 (required)' }), '13号');
  await user.type(within(added).getByRole('textbox', { name: 'SKU' }), 'moon-13');
  await user.type(within(added).getByRole('spinbutton', { name: 'Price (yen, tax incl.)' }), '26000');
  await user.type(within(added).getByRole('spinbutton', { name: 'On hand' }), '1');
  await user.click(screen.getByRole('button', { name: 'Save' }));

  expect(await screen.findByRole('status')).toHaveTextContent('Saved.');
  const body = await requests[0]?.json();
  expect(requests[0]?.headers.get('X-CSRF-Token')).toBe(ownerSession.csrfToken);
  expect(new URL(requests[0]?.url ?? '').pathname).toBe('/api/admin/products/moon-ring');
  expect(body).toMatchObject({
    version: 3,
    name: { ja: '月のリング', zh: '', en: 'Moon Ring' },
    variants: [
      { sku: 'moon-9', label: { ja: '9号', zh: '', en: '' }, priceYen: 24_000, onHandStock: 7 },
      { sku: 'moon-13', label: { ja: '13号', zh: '', en: '' }, priceYen: 26_000, onHandStock: 1 },
    ],
  });
  expect(body).not.toHaveProperty('slug');
});

test('an edit refused as outdated says so, and the owner can load the latest version', async () => {
  let current = moonRing;
  server.use(
    mockApi.adminSession(ownerSession),
    mockApi.adminCategories(categories),
    mockApi.adminProduct(() => current),
    mockApi.adminEditProduct({ status: 409, body: { error: 'stale_version' } }),
  );
  const user = userEvent.setup();
  renderRoute('/admin/products/moon-ring/edit');
  const nameJa = within(await screen.findByRole('group', { name: '商品名' })).getByRole('textbox', {
    name: '日本語（必須）',
  });
  await user.clear(nameJa);
  await user.type(nameJa, '私の変更');

  await user.click(screen.getByRole('button', { name: '保存する' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('この商品はほかの画面で変更されました。');
  current = { ...moonRing, name: { ja: 'ほかの変更' }, version: 4 };
  await user.click(screen.getByRole('button', { name: '最新の内容を読み込む' }));

  await waitFor(() =>
    expect(within(screen.getByRole('group', { name: '商品名' })).getByRole('textbox', { name: '日本語（必須）' })).toHaveValue(
      'ほかの変更',
    ),
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test.each([
  { status: 'draft', statusChanges: ['list', 'archive'], actions: ['販売を開始する', 'アーカイブする'] },
  { status: 'listed', statusChanges: ['unlist', 'archive'], actions: ['販売を停止する', 'アーカイブする'] },
  { status: 'archived', statusChanges: ['restore'], actions: ['下書きに戻す'] },
] as const)('a $status product offers the status changes the API allows it', async ({ status, statusChanges, actions }) => {
  server.use(
    mockApi.adminSession(ownerSession),
    mockApi.adminCategories(categories),
    mockApi.adminProduct({ ...moonRing, status, statusChanges: [...statusChanges] }),
  );

  renderRoute('/admin/products/moon-ring/edit');

  const panel = await screen.findByRole('region', { name: '販売状態' });
  expect(within(panel).getAllByRole('button').map((button) => button.textContent)).toEqual(actions);
});

test('listing a draft asks the API with the version the owner saw, then shows the new status', async () => {
  let current = moonRing;
  const requests: Request[] = [];
  server.use(
    mockApi.adminSession(ownerSession),
    mockApi.adminCategories(categories),
    mockApi.adminProduct(() => current),
    mockApi.adminChangeProductStatus(
      { status: 200, body: { ...moonRing, status: 'listed', statusChanges: ['unlist', 'archive'], version: 4 } },
      requests,
    ),
  );
  const user = userEvent.setup();
  renderRoute('/admin/products/moon-ring/edit');
  const panel = await screen.findByRole('region', { name: '販売状態' });
  expect(within(panel).getByText('下書き')).toBeInTheDocument();

  current = { ...moonRing, status: 'listed', statusChanges: ['unlist', 'archive'], version: 4 };
  await user.click(within(panel).getByRole('button', { name: '販売を開始する' }));

  expect(await within(panel).findByText('販売中')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('販売状態を変更しました。');
  expect(new URL(requests[0]?.url ?? '').pathname).toBe('/api/admin/products/moon-ring/list');
  expect(requests[0]?.headers.get('X-CSRF-Token')).toBe(ownerSession.csrfToken);
  expect(await requests[0]?.json()).toEqual({ version: 3 });
});

test('changing the status keeps the owner’s unsaved edits, which are then saved onto the new version', async () => {
  let current = moonRing;
  const listed: AdminProduct = { ...moonRing, status: 'listed', statusChanges: ['unlist', 'archive'], version: 4 };
  const edits: Request[] = [];
  server.use(
    mockApi.adminSession(ownerSession),
    mockApi.adminCategories(categories),
    mockApi.adminProduct(() => current),
    mockApi.adminChangeProductStatus({ status: 200, body: listed }),
    mockApi.adminEditProduct({ status: 200, body: { ...listed, version: 5 } }, edits),
  );
  const user = userEvent.setup();
  renderRoute('/admin/products/moon-ring/edit');
  const nameJa = () => within(screen.getByRole('group', { name: '商品名' })).getByRole('textbox', { name: '日本語（必須）' });
  const panel = await screen.findByRole('region', { name: '販売状態' });
  await user.clear(nameJa());
  await user.type(nameJa(), 'まだ保存していない名前');

  current = listed;
  await user.click(within(panel).getByRole('button', { name: '販売を開始する' }));

  expect(await within(panel).findByText('販売中')).toBeInTheDocument();
  expect(nameJa()).toHaveValue('まだ保存していない名前');
  await user.click(screen.getByRole('button', { name: '保存する' }));
  await waitFor(() => expect(edits).toHaveLength(1));
  expect(await edits[0]?.json()).toMatchObject({ version: 4, name: { ja: 'まだ保存していない名前' } });
});

test.each([
  { path: '/admin/products/new', name: 'トップページでピックアップする', hint: '最も新しく販売を開始した1点だけ' },
  { path: '/zh/admin/products/new', name: '在首页主推', hint: '只显示最近上架的一件主推商品' },
  { path: '/en/admin/products/new', name: 'Feature on the home page', hint: 'only the most recently listed featured product' },
])('the featured checkbox says the home page shows one featured product only ($path)', async ({ path, name, hint }) => {
  server.use(mockApi.adminSession(ownerSession), mockApi.adminCategories(categories));

  renderRoute(path);

  expect(await screen.findByRole('checkbox', { name })).toHaveAccessibleDescription(expect.stringContaining(hint));
});
