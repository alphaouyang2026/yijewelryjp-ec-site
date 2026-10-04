import { zValidator } from '@hono/zod-validator';
import * as z from 'zod';
import { LOCALES } from '../shared-kernel/locale';

const localeQuerySchema = z.object({ locale: z.enum(LOCALES) });

/**
 * Validates the `locale` query parameter of a route that returns content in
 * the requested locale. A missing or unsupported locale gets 400.
 */
export const localeQuery = zValidator('query', localeQuerySchema, (result, c) => {
  if (!result.success) return c.json({ error: 'unsupported_locale', supportedLocales: LOCALES }, 400);
});
