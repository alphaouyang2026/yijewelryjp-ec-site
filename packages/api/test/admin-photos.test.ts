import { assert, describe, expect, test } from 'vitest';
import { TEST_PHOTO_BUCKET, TEST_PHOTO_CREDENTIALS, useTestApi } from './support/test-api';

const api = useTestApi();

type Owner = Awaited<ReturnType<typeof api.owner>>;

const FIVE_MB = 5 * 1024 * 1024;

/** Asks for an upload form for a photo of `contentType` and `size` bytes, as the product form does before uploading. */
function startUpload(owner: Owner, contentType: string, size = 200_000) {
  return owner.client.api.admin['photo-uploads'].$post({ json: { contentType, size } }, { headers: owner.headers });
}

/** A photo's key from an upload form, as the owner's browser gets one before uploading the file. */
async function uploadedKey(owner: Owner, contentType = 'image/jpeg') {
  const res = await startUpload(owner, contentType);
  assert(res.status === 200, `Expected an upload form, got ${res.status}`);
  return (await res.json()).key;
}

/** The policy of an upload form, which S3 checks the upload against. */
function policyOf(fields: Record<string, string>) {
  return JSON.parse(Buffer.from(fields.Policy ?? '', 'base64').toString('utf8')) as {
    expiration: string;
    conditions: unknown[];
  };
}

describe('uploading a photo', () => {
  test.each([
    { contentType: 'image/jpeg', extension: 'jpg' },
    { contentType: 'image/png', extension: 'png' },
    { contentType: 'image/webp', extension: 'webp' },
  ])('a $contentType photo gets a new key and a form to post it straight to the bucket', async ({ contentType, extension }) => {
    const owner = await api.owner();

    const [first, second] = await Promise.all([startUpload(owner, contentType), startUpload(owner, contentType)]);

    assert(first.status === 200 && second.status === 200);
    const photo = await first.json();
    expect(photo.key).toMatch(new RegExp(`^images/products/[0-9a-f-]{36}\\.${extension}$`));
    expect(photo.url).toBe(`/${photo.key}`);
    expect(photo.upload.url).toBe(`https://${TEST_PHOTO_BUCKET}.s3.ap-northeast-1.amazonaws.com/`);
    expect(photo.upload.fields).toMatchObject({ key: photo.key, 'Content-Type': contentType });
    // Keys are never reused: a photo never changes under its key.
    expect((await second.json()).key).not.toBe(photo.key);
  });

  test('the form’s signed policy lets the bucket take only that type, 1 byte to 5 MB, under that key, cached for a year', async () => {
    const owner = await api.owner();

    const res = await startUpload(owner, 'image/png');

    assert(res.status === 200);
    const { key, upload } = await res.json();
    const policy = policyOf(upload.fields);
    expect(policy.conditions).toEqual(
      expect.arrayContaining([
        ['content-length-range', 1, FIVE_MB],
        { 'Content-Type': 'image/png' },
        { key },
        { bucket: TEST_PHOTO_BUCKET },
        { 'Cache-Control': 'public, max-age=31536000, immutable' },
      ]),
    );
    // Every field the form sends is in the policy as it is, so none can be changed.
    for (const [name, value] of Object.entries(upload.fields)) {
      if (name !== 'Policy' && name !== 'X-Amz-Signature') expect(policy.conditions).toContainEqual({ [name]: value });
    }
    expect(upload.fields['X-Amz-Credential']).toMatch(new RegExp(`^${TEST_PHOTO_CREDENTIALS.accessKeyId}/`));
    expect(upload.fields['X-Amz-Signature']).toMatch(/^[0-9a-f]{64}$/);
    const minutesValid = (new Date(policy.expiration).getTime() - Date.now()) / 60_000;
    expect(minutesValid).toBeGreaterThan(5);
    expect(minutesValid).toBeLessThanOrEqual(10);
  });

  test.each(['image/gif', 'image/svg+xml', 'image/heic', 'application/pdf', ''])(
    'a photo of type “%s” is refused, saying only JPEG, PNG and WebP can be uploaded',
    async (contentType) => {
      const owner = await api.owner();

      const res = await startUpload(owner, contentType);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: 'invalid_input',
        fields: [{ path: 'contentType', code: 'unsupported_photo_type' }],
      });
    },
  );

  test('a photo over 5 MB is refused, saying it is too large; 5 MB itself is fine', async () => {
    const owner = await api.owner();

    const tooLarge = await startUpload(owner, 'image/jpeg', FIVE_MB + 1);
    const largest = await startUpload(owner, 'image/jpeg', FIVE_MB);

    expect(tooLarge.status).toBe(400);
    expect(await tooLarge.json()).toEqual({
      error: 'invalid_input',
      fields: [{ path: 'size', code: 'photo_too_large' }],
    });
    expect(largest.status).toBe(200);
  });

  test('an empty file is refused', async () => {
    const owner = await api.owner();

    const res = await startUpload(owner, 'image/jpeg', 0);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_input', fields: [{ path: 'size', code: 'invalid' }] });
  });
});

/** What the admin's product form sends for a product with `photos`; `slug` makes it unique. */
function productWith(slug: string, photos: { key: string; alt: { ja: string; zh?: string; en?: string } }[]) {
  return {
    slug,
    name: { ja: `${slug}の名前`, zh: '', en: '' },
    description: { ja: '説明', zh: '', en: '' },
    materials: null,
    dimensions: null,
    weight: null,
    care: null,
    categorySlug: null,
    featured: true,
    variants: [{ sku: slug, label: { ja: 'フリー', zh: '', en: '' }, priceYen: 20_000, onHandStock: 2 }],
    photos,
  };
}

async function createListed(owner: Owner, product: ReturnType<typeof productWith>) {
  const created = await owner.client.api.admin.products.$post({ json: product }, { headers: owner.headers });
  assert(created.status === 201, `Expected the product to be created, got ${created.status}`);
  const listed = await owner.client.api.admin.products[':slug'].list.$post(
    { param: { slug: product.slug }, json: { version: 1 } },
    { headers: owner.headers },
  );
  assert(listed.status === 200);
  return listed.json();
}

describe('a product’s photos', () => {
  test('are saved in the owner’s order with their alt text, and the admin shows each with its URL', async () => {
    const owner = await api.owner();
    const [front, side] = [await uploadedKey(owner), await uploadedKey(owner, 'image/webp')];

    const res = await owner.client.api.admin.products.$post(
      {
        json: productWith('photo-ring', [
          { key: front, alt: { ja: '正面から見たリング', zh: '', en: 'The ring from the front' } },
          { key: side, alt: { ja: '横から見たリング', zh: '从侧面看的戒指', en: '' } },
        ]),
      },
      { headers: owner.headers },
    );

    assert(res.status === 201);
    const photos = [
      { key: front, url: `/${front}`, alt: { ja: '正面から見たリング', en: 'The ring from the front' } },
      { key: side, url: `/${side}`, alt: { ja: '横から見たリング', zh: '从侧面看的戒指' } },
    ];
    expect((await res.json()).photos).toEqual(photos);
    const read = await owner.client.api.admin.products[':slug'].$get({ param: { slug: 'photo-ring' } });
    assert(read.status === 200);
    expect((await read.json()).photos).toEqual(photos);
  });

  test('cannot be saved without Japanese alt text, and nothing changes', async () => {
    const owner = await api.owner();
    const [first, second] = [await uploadedKey(owner), await uploadedKey(owner)];
    const product = await createListed(owner, productWith('alt-ring', [{ key: first, alt: { ja: '正面' } }]));

    const res = await owner.client.api.admin.products[':slug'].$put(
      {
        param: { slug: 'alt-ring' },
        json: {
          ...productWith('alt-ring', [
            { key: first, alt: { ja: '正面' } },
            { key: second, alt: { ja: '  ', zh: '侧面', en: 'Side' } },
          ]),
          version: product.version,
        },
      },
      { headers: owner.headers },
    );
    const created = await owner.client.api.admin.products.$post(
      { json: productWith('no-alt-ring', [{ key: second, alt: { ja: '' } }]) },
      { headers: owner.headers },
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_input', fields: [{ path: 'photos.1.alt.ja', code: 'required' }] });
    expect(created.status).toBe(400);
    expect(await created.json()).toEqual({ error: 'invalid_input', fields: [{ path: 'photos.0.alt.ja', code: 'required' }] });
    const page = await api.client().api.products[':slug'].$get({ param: { slug: 'alt-ring' }, query: { locale: 'ja' } });
    assert(page.status === 200);
    expect((await page.json()).product.photos).toEqual([{ url: `/${first}`, alt: '正面' }]);
  });

  test.each([
    'images/products/../../index.html',
    'images/products/not-a-uuid.jpg',
    'assets/index-1234abcd.js',
    'https://example.com/images/products/0f8fad5b-d9cb-469f-a165-70867728950e.jpg',
    'images/products/0f8fad5b-d9cb-469f-a165-70867728950e.gif',
  ])('cannot have a key no upload gives: %s', async (key) => {
    const owner = await api.owner();

    const res = await owner.client.api.admin.products.$post(
      { json: productWith('bad-key-ring', [{ key, alt: { ja: '写真' } }]) },
      { headers: owner.headers },
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_input', fields: [{ path: 'photos.0.key', code: 'invalid' }] });
  });

  test('cannot have the same photo twice', async () => {
    const owner = await api.owner();
    const key = await uploadedKey(owner);

    const res = await owner.client.api.admin.products.$post(
      { json: productWith('twice-ring', [{ key, alt: { ja: '正面' } }, { key, alt: { ja: 'もう一度' } }]) },
      { headers: owner.headers },
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_input', fields: [{ path: 'photos', code: 'invalid' }] });
  });

  test('show in the store in the owner’s order: all on the product page, the first in lists and on the home page', async () => {
    // Listed after the file's other products, so it is the newest arrival and the home page's pick.
    api.clock.set(new Date('2026-10-01T10:00:00+09:00'));
    const owner = await api.owner();
    const [front, side, back] = [await uploadedKey(owner), await uploadedKey(owner), await uploadedKey(owner, 'image/png')];
    const alt = {
      front: { ja: '正面', en: 'Front' },
      side: { ja: '横', zh: '侧面', en: 'Side' },
      back: { ja: '裏' },
    };
    const product = await createListed(
      owner,
      productWith('gallery-ring', [
        { key: front, alt: alt.front },
        { key: side, alt: alt.side },
        { key: back, alt: alt.back },
      ]),
    );

    const store = api.client().api;
    const page = await store.products[':slug'].$get({ param: { slug: 'gallery-ring' }, query: { locale: 'zh' } });
    const list = await store.products.$get({ query: { locale: 'en' } });
    const home = await store.home.$get({ query: { locale: 'ja' } });

    assert(page.status === 200 && list.status === 200 && home.status === 200);
    // Chinese where entered, Japanese where not.
    expect((await page.json()).product.photos).toEqual([
      { url: `/${front}`, alt: '正面' },
      { url: `/${side}`, alt: '侧面' },
      { url: `/${back}`, alt: '裏' },
    ]);
    expect((await list.json()).products.find((p) => p.slug === 'gallery-ring')?.photo).toEqual({ url: `/${front}`, alt: 'Front' });
    const homeData = await home.json();
    expect(homeData.featured).toMatchObject({ slug: 'gallery-ring', photo: { url: `/${front}`, alt: '正面' } });
    expect(homeData.newArrivals[0]).toMatchObject({ slug: 'gallery-ring', photo: { url: `/${front}`, alt: '正面' } });

    // The owner moves the back to the front and removes the side.
    const edited = await owner.client.api.admin.products[':slug'].$put(
      {
        param: { slug: 'gallery-ring' },
        json: {
          ...productWith('gallery-ring', [
            { key: back, alt: alt.back },
            { key: front, alt: alt.front },
          ]),
          version: product.version,
        },
      },
      { headers: owner.headers },
    );
    assert(edited.status === 200);

    const pageAfter = await store.products[':slug'].$get({ param: { slug: 'gallery-ring' }, query: { locale: 'en' } });
    const listAfter = await store.products.$get({ query: { locale: 'en' } });
    assert(pageAfter.status === 200 && listAfter.status === 200);
    expect((await pageAfter.json()).product.photos).toEqual([
      { url: `/${back}`, alt: '裏' },
      { url: `/${front}`, alt: 'Front' },
    ]);
    expect((await listAfter.json()).products.find((p) => p.slug === 'gallery-ring')?.photo).toEqual({ url: `/${back}`, alt: '裏' });
  });

  test('a product without photos has none on its page, and no photo in lists', async () => {
    const owner = await api.owner();
    await createListed(owner, productWith('bare-ring', []));

    const page = await api.client().api.products[':slug'].$get({ param: { slug: 'bare-ring' }, query: { locale: 'ja' } });
    const list = await api.client().api.products.$get({ query: { locale: 'ja' } });

    assert(page.status === 200 && list.status === 200);
    expect((await page.json()).product.photos).toEqual([]);
    expect((await list.json()).products.find((p) => p.slug === 'bare-ring')?.photo).toBeNull();
  });
});
