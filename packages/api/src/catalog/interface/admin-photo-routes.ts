import { Hono } from 'hono';
import type { StartPhotoUpload } from '../application/start-photo-upload';
import { catalogJsonBody, photoUploadBody } from './admin-catalog-input';

/** Photo uploads for the admin's product form, behind the owner-only guard (mounted in the admin route group). */
export function adminPhotoUploadRoutes(useCases: { startPhotoUpload: StartPhotoUpload }) {
  return new Hono().post('/', catalogJsonBody(photoUploadBody), async (c) =>
    c.json(await useCases.startPhotoUpload({ type: c.req.valid('json').contentType }), 200),
  );
}
