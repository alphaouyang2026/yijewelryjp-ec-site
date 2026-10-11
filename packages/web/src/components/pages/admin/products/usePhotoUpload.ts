import { blankText, type PhotoUploadResult } from '../../../../adminForms';
import { api } from '../../../../api';
import { useCsrfHeaders } from '../adminSession';

/**
 * How the product form uploads a photo the owner picked: it asks the API for
 * an upload form, which the API refuses for anything but JPEG, PNG and WebP,
 * and for files over 5 MB, saying which; then it posts the file with that
 * form straight to photo storage, which checks the same again.
 */
export function usePhotoUpload() {
  const headers = useCsrfHeaders();
  return async (file: File): Promise<PhotoUploadResult> => {
    try {
      const res = await api.admin['photo-uploads'].$post(
        { json: { contentType: file.type, size: file.size } },
        { headers },
      );
      if (res.status === 400) {
        const [field] = (await res.json()).fields;
        return { problem: field?.code ?? 'failed' };
      }
      if (!res.ok) return { problem: 'failed' };
      const { key, url, upload } = await res.json();
      const form = new FormData();
      for (const [name, value] of Object.entries(upload.fields)) form.append(name, value);
      // Storage reads the fields before the file, so the file goes last.
      form.append('file', file);
      const stored = await fetch(upload.url, { method: 'POST', body: form });
      return stored.ok ? { photo: { key, url, alt: blankText() } } : { problem: 'failed' };
    } catch {
      return { problem: 'failed' };
    }
  };
}
