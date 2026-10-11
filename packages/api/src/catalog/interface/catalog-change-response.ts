import type { Context } from 'hono';
import { invalidInput } from '../../interface/json-body';
import type { CatalogChange } from '../application/catalog-changes';

/**
 * The answer to an owner's change to the catalog, for every admin catalog
 * route: what is now stored (with `status`), or why nothing changed: 400 with
 * field errors for broken rules, 404, or 409 for a stale version or a status
 * change the product's status does not allow.
 */
export function changeResponse<Changed, Status extends 200 | 201>(
  c: Context,
  change: CatalogChange<Changed>,
  status: Status,
) {
  switch (change.outcome) {
    case 'changed':
      return c.json(change.changed, status);
    case 'invalid':
      return c.json(invalidInput(change.violations.map(({ path, rule }) => ({ path, code: rule }))), 400);
    case 'not_found':
      return c.json({ error: 'not_found' } as const, 404);
    case 'stale':
      return c.json({ error: 'stale_version' } as const, 409);
    case 'invalid_status_transition':
      return c.json({ error: 'invalid_status_transition' } as const, 409);
  }
}
