// A stand-in for the photo bucket in local development, kept in memory like
// DynamoDB Local's data: it takes S3's browser uploads (a POST of a form that
// s3PhotoStorage presigns) and serves the photos under /images/*. Only
// src/local.ts loads it (ESLint checks); production uploads go to S3 itself.
import { createHmac } from 'node:crypto';
import { Hono } from 'hono';

/** The credentials local upload forms are signed with, and checked against here. */
export const LOCAL_PHOTO_CREDENTIALS = { accessKeyId: 'local', secretAccessKey: 'local' };

export const LOCAL_PHOTO_BUCKET = 'local-photos';

type StoredPhoto = { body: ArrayBuffer; contentType: string; cacheControl?: string };

/** A condition of an S3 POST policy: `{ field: value }`, or `[operator, '$field' or a number, …]`. */
type PolicyCondition = Record<string, string> | [string, string | number, string | number];

/**
 * The routes S3 would answer for the photo bucket: POST /local-s3/:bucket
 * (an upload, checked as S3 checks it: the policy's signature, its
 * expiration and each of its conditions) and GET /images/* (a photo).
 */
export function localPhotoBucket() {
  const photos = new Map<string, StoredPhoto>();

  return new Hono()
    .post('/local-s3/:bucket', async (c) => {
      const form = await c.req.parseBody();
      const file = form.file;
      const fields = new Map<string, string>();
      for (const [name, value] of Object.entries(form)) {
        if (typeof value === 'string') fields.set(name.toLowerCase(), value);
      }
      fields.set('bucket', c.req.param('bucket'));
      if (!(file instanceof File)) return c.text('The form has no file.', 400);

      const problem = policyProblem(fields, file.size);
      if (problem) return c.text(problem, 403);

      photos.set(fields.get('key') ?? '', {
        body: await file.arrayBuffer(),
        contentType: fields.get('content-type') ?? 'application/octet-stream',
        cacheControl: fields.get('cache-control'),
      });
      return c.body(null, 204);
    })
    .get('/images/*', (c) => {
      const photo = photos.get(c.req.path.slice(1));
      if (!photo) return c.notFound();
      return c.body(photo.body, 200, {
        'Content-Type': photo.contentType,
        ...(photo.cacheControl && { 'Cache-Control': photo.cacheControl }),
      });
    });
}

/** Why S3 would refuse the upload of a file of `size` bytes with form `fields` (names lowercased); undefined if it would not. */
function policyProblem(fields: Map<string, string>, size: number): string | undefined {
  const encodedPolicy = fields.get('policy') ?? '';
  if (fields.get('x-amz-signature') !== signature(encodedPolicy, fields.get('x-amz-credential') ?? '')) {
    return 'The signature does not match the policy.';
  }
  const policy = JSON.parse(Buffer.from(encodedPolicy, 'base64').toString('utf8')) as {
    expiration: string;
    conditions: PolicyCondition[];
  };
  if (new Date(policy.expiration).getTime() < Date.now()) return 'The policy has expired.';

  const field = (name: string | number) => fields.get(String(name).replace(/^\$/, '').toLowerCase());
  for (const condition of policy.conditions) {
    if (!Array.isArray(condition)) {
      const [[name, value] = ['', '']] = Object.entries(condition);
      if (field(name) !== value) return `The form's ${name} does not match the policy.`;
    } else if (condition[0] === 'content-length-range') {
      if (size < Number(condition[1]) || size > Number(condition[2])) return 'The file is not the size the policy allows.';
    } else if (condition[0] === 'eq') {
      if (field(condition[1]) !== condition[2]) return `The form's ${condition[1]} does not match the policy.`;
    } else if (condition[0] === 'starts-with') {
      if (!field(condition[1])?.startsWith(String(condition[2]))) return `The form's ${condition[1]} does not match the policy.`;
    }
  }
  return undefined;
}

/** The SigV4 signature of a POST policy, as S3 computes it from the secret key and the credential's scope. */
function signature(encodedPolicy: string, credential: string): string {
  const [, date = '', region = '', service = ''] = credential.split('/');
  const hmac = (key: string | Buffer, data: string) => createHmac('sha256', key).update(data).digest();
  const signingKey = [date, region, service, 'aws4_request'].reduce<Buffer | string>(
    (key, part) => hmac(key, part),
    `AWS4${LOCAL_PHOTO_CREDENTIALS.secretAccessKey}`,
  );
  return createHmac('sha256', signingKey).update(encodedPolicy).digest('hex');
}
