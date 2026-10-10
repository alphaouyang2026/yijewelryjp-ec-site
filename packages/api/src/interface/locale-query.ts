import { zValidator } from '@hono/zod-validator';
import * as z from 'zod';
import { LOCALES } from '../shared-kernel/locale';

/**
 * Validates the query of a route that returns content in the requested
 * locale: `locale`, plus the route's own parameters in `shape`. A missing or
 * unsupported locale gets 400 unsupported_locale; any other invalid
 * parameter gets 400 invalid_query.
 */
export function localeQueryWith<Shape extends z.ZodRawShape>(shape: Shape) {
  return zValidator('query', z.object({ locale: z.enum(LOCALES), ...shape }), (result, c) => {
    if (result.success) return;
    if (result.error.issues.some((issue) => issue.path[0] === 'locale')) {
      return c.json({ error: 'unsupported_locale', supportedLocales: LOCALES }, 400);
    }
    return c.json({ error: 'invalid_query' }, 400);
  });
}

/** Validates a query that has only the `locale` parameter. */
export const localeQuery = localeQueryWith({});
