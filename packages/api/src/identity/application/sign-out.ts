import type { Locale } from '../../shared-kernel/locale';
import type { AdminIdentity } from '../domain/admin-identity';

export type SignOut = (locale: Locale) => { signOutUrl: string };

/**
 * Use case: the owner signs out. The API forgets the session (the interface
 * layer clears its cookie); the browser goes on to the identity provider to
 * end its sign-in session too, then to the store's home page in `locale`.
 */
export function signOut(deps: { adminIdentity: AdminIdentity }): SignOut {
  return (locale) => ({ signOutUrl: deps.adminIdentity.signOutUrl(locale) });
}
