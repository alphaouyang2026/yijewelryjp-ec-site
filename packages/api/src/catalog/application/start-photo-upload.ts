import { MAX_PHOTO_BYTES, newPhotoKey, type PhotoStorage, type PhotoType, type PhotoUploadForm } from '../domain/photo';
import { photoUrl } from './catalog-views';

export { MAX_PHOTO_BYTES, PHOTO_CONTENT_TYPES, PHOTO_KEY_PATTERN } from '../domain/photo';

/** A photo the owner is about to upload. */
export type PhotoUpload = {
  /** The photo's key, which the product form saves the photo with once it is uploaded. */
  key: string;
  /** Where the photo is served once uploaded, for the form's preview. */
  url: string;
  /** Where the browser posts the file, with these form fields (the file goes last, as `file`). */
  upload: PhotoUploadForm;
};

export type StartPhotoUpload = (photo: { type: PhotoType }) => Promise<PhotoUpload>;

/**
 * Use case: the owner uploads a photo of `type`, straight from the browser
 * to photo storage, under a new key. Storage refuses any other type, and
 * files over 5 MB. The photo becomes a product's when the owner saves the
 * product with its key.
 */
export function startPhotoUpload(deps: { photoStorage: PhotoStorage }): StartPhotoUpload {
  return async ({ type }) => {
    const key = newPhotoKey(type);
    const upload = await deps.photoStorage.uploadForm({ key, type, maxBytes: MAX_PHOTO_BYTES });
    return { key, url: photoUrl(key), upload };
  };
}
