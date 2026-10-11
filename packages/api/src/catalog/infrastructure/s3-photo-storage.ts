import type { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import type { PhotoStorage } from '../domain/photo';

/**
 * A photo's key never names other content, so browsers and CloudFront keep it
 * for a year. Stored with the photo, as the response header S3 serves it with.
 */
const PHOTO_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** How long an upload form stays valid: time enough to start uploading 5 MB on a slow connection. */
const UPLOAD_FORM_SECONDS = 10 * 60;

/**
 * Photos in an S3 bucket, uploaded with presigned POST forms. Signing a form
 * is computed locally from the client's credentials, with no request to S3;
 * S3 checks the form's policy when the browser posts the file. Every field
 * of the form is in the policy as an exact match (the SDK adds them), so the
 * key, content type and Cache-Control cannot be changed, and the file must
 * be 1 to `maxBytes` bytes.
 */
export function s3PhotoStorage({ client, bucket }: { client: S3Client; bucket: string }): PhotoStorage {
  return {
    async uploadForm({ key, type, maxBytes }) {
      const { url, fields } = await createPresignedPost(client, {
        Bucket: bucket,
        Key: key,
        Fields: { 'Content-Type': type, 'Cache-Control': PHOTO_CACHE_CONTROL },
        Conditions: [['content-length-range', 1, maxBytes]],
        Expires: UPLOAD_FORM_SECONDS,
      });
      return { url, fields };
    },
  };
}
