import type { LocalizedText } from '../../shared-kernel/localized-text';

/**
 * A photo of a product: the key it is stored under, and its alt text, kept
 * per locale, which says what it shows to customers who cannot see it. A key
 * never names other content (a new photo gets a new key), so a photo can be
 * cached for as long as anyone likes.
 */
export type ProductPhoto = { readonly key: string; readonly alt: LocalizedText };

/** The kinds of image a photo can be, by content type, with the file extension its key ends in. */
export const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;
export type PhotoType = keyof typeof PHOTO_TYPES;
export const PHOTO_CONTENT_TYPES = Object.keys(PHOTO_TYPES) as PhotoType[];

/** The largest photo the owner can upload: 5 MB. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** The keys `newPhotoKey` makes: a random UUID under images/products/, and the type's extension. */
export const PHOTO_KEY_PATTERN = /^images\/products\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

/** A key for a new photo of `type`: random, so no other photo ever had it. */
export function newPhotoKey(type: PhotoType): string {
  return `images/products/${crypto.randomUUID()}.${PHOTO_TYPES[type]}`;
}

/** Where the owner's browser posts a photo's file, and the form fields that go with it. */
export type PhotoUploadForm = { url: string; fields: Record<string, string> };

/**
 * Where product photos are stored (production: S3). The owner's browser
 * uploads each photo straight to it, never through the API.
 */
export interface PhotoStorage {
  /**
   * A form for uploading one photo under `key`. Storage accepts the upload
   * only with content type `type`, of at most `maxBytes`, and only for a
   * limited time; the photo is then served with a long cache lifetime.
   */
  uploadForm(photo: { key: string; type: PhotoType; maxBytes: number }): Promise<PhotoUploadForm>;
}
