import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';
import type { AdminCategoryList } from '../../../../api';
import { mockApi, ownerSession } from '../../../../test/api-mocks';
import { renderRoute } from '../../../../test/render';
import { server } from '../../../../test/server';

const categories: AdminCategoryList = {
  categories: [
    { slug: 'rings', displayName: 'リング', name: { ja: 'リング', en: 'Rings' }, version: 2 },
    { slug: 'necklaces', displayName: 'ネックレス', name: { ja: 'ネックレス' }, version: 1 },
    { slug: 'earrings', displayName: 'ピアス', name: { ja: 'ピアス' }, version: 5 },
  ],
};

/** The category names in the order the page lists them. */
async function listedNames() {
  const list = await screen.findByRole('list', { name: '並び順' });
  return within(list)
    .getAllByRole('listitem')
    .map((item) => within(item).getByRole('heading').textContent);
}

test('the categories page lists the categories in the owner’s order', async () => {
  server.use(mockApi.adminSession(ownerSession), mockApi.adminCategories(categories));

  renderRoute('/admin/categories');

  expect(await screen.findByRole('heading', { level: 1, name: 'カテゴリー' })).toBeInTheDocument();
  expect(await listedNames()).toEqual(['リング', 'ネックレス', 'ピアス']);
  expect(screen.getByRole('button', { name: 'リング を上へ' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'ピアス を下へ' })).toBeDisabled();
});

test('moving a category sends the whole new order with the versions the owner saw, then shows it', async () => {
  let current = categories;
  const requests: Request[] = [];
  const reordered: AdminCategoryList = {
    categories: [categories.categories[1]!, categories.categories[0]!, categories.categories[2]!].map((category) => ({
      ...category,
      version: category.version + 1,
    })),
  };
  server.use(
    mockApi.adminSession(ownerSession),
    mockApi.adminCategories(() => current),
    mockApi.adminReorderCategories({ status: 200, body: reordered }, requests),
  );
  const user = userEvent.setup();
  renderRoute('/admin/categories');
  await screen.findByRole('list', { name: '並び順' });

  current = reordered;
  await user.click(screen.getByRole('button', { name: 'ネックレス を上へ' }));

  expect(await screen.findByRole('status')).toHaveTextContent('並び順を保存しました。');
  await waitFor(async () => expect(await listedNames()).toEqual(['ネックレス', 'リング', 'ピアス']));
  expect(requests[0]?.headers.get('X-CSRF-Token')).toBe(ownerSession.csrfToken);
  expect(new URL(requests[0]?.url ?? '').searchParams.get('locale')).toBe('ja');
  expect(await requests[0]?.json()).toEqual({
    categories: [
      { slug: 'necklaces', version: 1 },
      { slug: 'rings', version: 2 },
      { slug: 'earrings', version: 5 },
    ],
  });
});

test('an order made from outdated categories is refused, and the owner can load the latest', async () => {
  server.use(
    mockApi.adminSession(ownerSession),
    mockApi.adminCategories(categories),
    mockApi.adminReorderCategories({ status: 409, body: { error: 'stale_version' } }),
  );
  const user = userEvent.setup();
  renderRoute('/en/admin/categories');

  await user.click(await screen.findByRole('button', { name: 'Move ピアス up' }));

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('The categories were changed elsewhere.');
  await user.click(within(alert).getByRole('button', { name: 'Load the latest version' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

test('renaming a category sends its names in each locale with its version', async () => {
  const requests: Request[] = [];
  server.use(
    mockApi.adminSession(ownerSession),
    mockApi.adminCategories(categories),
    mockApi.adminRenameCategory(
      { status: 200, body: { slug: 'rings', name: { ja: '指輪', en: 'Rings' }, version: 3 } },
      requests,
    ),
  );
  const user = userEvent.setup();
  renderRoute('/admin/categories');
  const names = await screen.findByRole('group', { name: 'リング の名前' });
  const ja = within(names).getByRole('textbox', { name: '日本語（必須）' });
  expect(within(names).getByRole('textbox', { name: 'English' })).toHaveValue('Rings');

  await user.clear(ja);
  await user.type(ja, '指輪');
  const rings = within(screen.getByRole('list', { name: '並び順' })).getAllByRole('listitem')[0]!;
  await user.click(within(rings).getByRole('button', { name: '保存する' }));

  expect(await screen.findByRole('status')).toHaveTextContent('保存しました。');
  expect(new URL(requests[0]?.url ?? '').pathname).toBe('/api/admin/categories/rings');
  expect(await requests[0]?.json()).toEqual({ name: { ja: '指輪', zh: '', en: 'Rings' }, version: 2 });
});

test('the new-category form sends the slug and names, and shows the API’s errors next to each field', async () => {
  const requests: Request[] = [];
  server.use(
    mockApi.adminSession(ownerSession),
    mockApi.adminCategories(categories),
    mockApi.adminCreateCategory(
      {
        status: 400,
        body: {
          error: 'invalid_input',
          fields: [
            { path: 'slug', code: 'slug_taken' },
            { path: 'name.ja', code: 'required' },
          ],
        },
      },
      requests,
    ),
  );
  const user = userEvent.setup();
  renderRoute('/zh/admin/categories');
  const form = await screen.findByRole('region', { name: '添加类别' });

  await user.type(within(form).getByRole('textbox', { name: 'Slug（URL）' }), 'rings');
  await user.type(within(form).getByRole('textbox', { name: '中文' }), '戒指');
  await user.click(within(form).getByRole('button', { name: '添加' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('请检查输入内容。');
  expect(within(form).getByRole('textbox', { name: 'Slug（URL）' })).toHaveAccessibleDescription(
    expect.stringContaining('此 Slug 已被使用。'),
  );
  expect(within(form).getByRole('textbox', { name: '日本語（必填）' })).toHaveAccessibleDescription('请填写。');
  expect(requests[0]?.headers.get('X-CSRF-Token')).toBe(ownerSession.csrfToken);
  expect(await requests[0]?.json()).toEqual({ slug: 'rings', name: { ja: '', zh: '戒指', en: '' } });
});
