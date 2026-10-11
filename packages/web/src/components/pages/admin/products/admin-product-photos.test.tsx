import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';
import type { AdminProduct } from '../../../../api';
import { mockApi, ownerSession, photoUploadForm } from '../../../../test/api-mocks';
import { renderRoute } from '../../../../test/render';
import { server } from '../../../../test/server';

const FRONT = 'images/products/0f8fad5b-d9cb-469f-a165-70867728950e.jpg';
const SIDE = 'images/products/7c9e6679-7425-40de-944b-e07fc1f90ae7.png';
const BACK = 'images/products/9b2f6f3e-1c4e-4d39-8f3a-2a6a1f0c6b11.webp';

const moonRing: AdminProduct = {
  slug: 'moon-ring',
  status: 'listed',
  statusChanges: ['unlist', 'archive'],
  name: { ja: '月のリング' },
  description: { ja: '月をかたどったリング。' },
  materials: null,
  dimensions: null,
  weight: null,
  care: null,
  categorySlug: null,
  featured: false,
  listedAt: '2026-09-01T01:00:00.000Z',
  version: 3,
  variants: [{ sku: 'moon-9', label: { ja: '9号' }, priceYen: 24_000, onHandStock: 3, reservedStock: 0 }],
  photos: [{ key: FRONT, url: `/${FRONT}`, alt: { ja: '正面から見たリング', en: 'The ring from the front' } }],
};

/** A file as the owner's browser picks it. */
const photoFile = (name: string, type: string) => new File(['photo bytes'], name, { type });

/** The fieldset (group) of a photo, or of its alt text. */
const group = (name: string, container: HTMLElement = document.body) => within(container).getByRole('group', { name });

beforeEach(() => {
  server.use(mockApi.adminSession(ownerSession), mockApi.adminCategories({ categories: [] }), mockApi.adminProduct(moonRing));
});

test('the owner uploads photos straight to storage, writes their alt text, reorders them and saves them in that order', async () => {
  const uploadRequests: Request[] = [];
  const uploads: FormData[] = [];
  const saves: Request[] = [];
  server.use(
    mockApi.adminPhotoUploads([photoUploadForm(SIDE, 'image/png'), photoUploadForm(BACK, 'image/webp')], uploadRequests),
    mockApi.photoStorage(204, uploads),
    mockApi.adminEditProduct({ status: 200, body: { ...moonRing, version: 4 } }, saves),
  );
  const user = userEvent.setup();
  renderRoute('/admin/products/moon-ring/edit');

  // The stored photo, with its preview and alt text.
  const stored = await screen.findByRole('group', { name: '写真 1' });
  expect(within(stored).getByRole('img')).toHaveAttribute('src', `/${FRONT}`);
  expect(within(group('代替テキスト', stored)).getByRole('textbox', { name: '日本語（必須）' })).toHaveValue('正面から見たリング');

  const side = photoFile('side.png', 'image/png');
  await user.upload(screen.getByLabelText('写真を追加'), [side, photoFile('back.webp', 'image/webp')]);

  const back = await screen.findByRole('group', { name: '写真 3' });
  // Each upload asks the API for a form, with the CSRF token, then posts the file with it.
  expect(await Promise.all(uploadRequests.map((request) => request.json()))).toEqual([
    { contentType: 'image/png', size: side.size },
    { contentType: 'image/webp', size: side.size },
  ]);
  expect(uploadRequests[0]?.headers.get('X-CSRF-Token')).toBe(ownerSession.csrfToken);
  expect(uploads.map((form) => [form.get('key'), form.get('Content-Type'), (form.get('file') as File).name])).toEqual([
    [SIDE, 'image/png', 'side.png'],
    [BACK, 'image/webp', 'back.webp'],
  ]);
  expect(within(group('写真 2')).getByRole('img')).toHaveAttribute('src', `/${SIDE}`);
  expect(within(back).getByRole('img')).toHaveAttribute('src', `/${BACK}`);

  await user.type(within(group('代替テキスト', group('写真 2'))).getByRole('textbox', { name: '日本語（必須）' }), '横から見たリング');
  await user.type(within(group('代替テキスト', back)).getByRole('textbox', { name: '日本語（必須）' }), '裏から見たリング');
  await user.type(within(group('代替テキスト', back)).getByRole('textbox', { name: 'English' }), 'The back');
  // The back first, the side removed.
  await user.click(screen.getByRole('button', { name: '写真 3 を前へ' }));
  await user.click(screen.getByRole('button', { name: '写真 2 を前へ' }));
  expect(screen.getByRole('button', { name: '写真 1 を前へ' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '写真 3 を外す' }));
  await user.click(screen.getByRole('button', { name: '保存する' }));

  expect(await screen.findByRole('status')).toHaveTextContent('保存しました。');
  expect(await saves[0]?.json()).toMatchObject({
    version: 3,
    photos: [
      { key: BACK, alt: { ja: '裏から見たリング', zh: '', en: 'The back' } },
      { key: FRONT, alt: { ja: '正面から見たリング', zh: '', en: 'The ring from the front' } },
    ],
  });
});

test.each([
  { code: 'unsupported_photo_type' as const, file: photoFile('moon.gif', 'image/gif'), message: 'moon.gif：JPEG・PNG・WebP 形式の写真を選んでください。' },
  { code: 'photo_too_large' as const, file: photoFile('moon.jpg', 'image/jpeg'), message: 'moon.jpg：5MB以下の写真を選んでください。' },
])('a photo the API refuses ($code) is not added, and the form says why', async ({ code, file, message }) => {
  const uploads: FormData[] = [];
  server.use(
    mockApi.adminPhotoUploads([{ error: 'invalid_input', fields: [{ path: code === 'photo_too_large' ? 'size' : 'contentType', code }] }]),
    mockApi.photoStorage(204, uploads),
  );
  // The picker offers JPEG, PNG and WebP only, but the owner can still pick another file.
  const user = userEvent.setup({ applyAccept: false });
  renderRoute('/admin/products/moon-ring/edit');

  await user.upload(await screen.findByLabelText('写真を追加'), file);

  expect(await screen.findByText(message)).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: '写真 2' })).not.toBeInTheDocument();
  expect(uploads).toEqual([]);
  expect(screen.getByRole('button', { name: '保存する' })).toBeEnabled();
});

test('a photo storage does not take is not added, and the form says so', async () => {
  server.use(mockApi.adminPhotoUploads([photoUploadForm(SIDE)]), mockApi.photoStorage(403));
  const user = userEvent.setup();
  renderRoute('/en/admin/products/moon-ring/edit');

  await user.upload(await screen.findByLabelText('Add photos'), photoFile('side.jpg', 'image/jpeg'));

  expect(await screen.findByText('side.jpg: It could not be uploaded. Please try again.')).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'Photo 2' })).not.toBeInTheDocument();
});

test('saving a photo without Japanese alt text shows the API’s error by that photo’s alt text', async () => {
  server.use(
    mockApi.adminEditProduct({
      status: 400,
      body: { error: 'invalid_input', fields: [{ path: 'photos.0.alt.ja', code: 'required' }] },
    }),
  );
  const user = userEvent.setup();
  renderRoute('/zh/admin/products/moon-ring/edit');

  const alt = within(group('替代文字', await screen.findByRole('group', { name: '照片 1' })));
  await user.clear(alt.getByRole('textbox', { name: '日本語（必填）' }));
  await user.click(screen.getByRole('button', { name: '保存' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('请检查输入内容。');
  const altJa = alt.getByRole('textbox', { name: '日本語（必填）' });
  expect(altJa).toBeInvalid();
  expect(altJa).toHaveAccessibleDescription(expect.stringContaining('请填写。'));
});

test('a new product can be created with photos', async () => {
  const creates: Request[] = [];
  server.use(
    mockApi.adminPhotoUploads([photoUploadForm(SIDE)]),
    mockApi.photoStorage(204),
    mockApi.adminCreateProduct({ status: 400, body: { error: 'invalid_input', fields: [{ path: 'slug', code: 'required' }] } }, creates),
  );
  const user = userEvent.setup();
  renderRoute('/admin/products/new');

  await user.upload(await screen.findByLabelText('写真を追加'), photoFile('side.jpg', 'image/jpeg'));
  await user.type(
    within(group('代替テキスト', await screen.findByRole('group', { name: '写真 1' }))).getByRole('textbox', {
      name: '日本語（必須）',
    }),
    '横から見たリング',
  );
  await user.click(screen.getByRole('button', { name: '下書きとして作成' }));

  await screen.findByRole('alert');
  expect(await creates[0]?.json()).toMatchObject({
    photos: [{ key: SIDE, alt: { ja: '横から見たリング', zh: '', en: '' } }],
  });
});
