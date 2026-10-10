import { randomUUID } from 'node:crypto';
import type { AdminIdentity } from '../../src/identity/domain/admin-identity';
import type { Owner } from '../../src/identity/domain/owner';

/** Where the in-memory provider's pages would be. */
export const IDENTITY_ORIGIN = 'https://identity.test';

export type InMemoryAdminIdentity = AdminIdentity & {
  /**
   * The owner signs in on the provider's pages: the authorization code the
   * provider would send back to the API's callback. Each code works once.
   */
  issueCode(owner: Owner): string;
};

/** The AdminIdentity tests use: owners sign in by getting a code from `issueCode`. */
export function createInMemoryAdminIdentity(): InMemoryAdminIdentity {
  const owners = new Map<string, Owner>();
  return {
    signInUrl: ({ state, locale }) => `${IDENTITY_ORIGIN}/sign-in?${new URLSearchParams({ state, lang: locale })}`,
    signOutUrl: (locale) => `${IDENTITY_ORIGIN}/sign-out?${new URLSearchParams({ lang: locale })}`,
    async ownerForCode(code) {
      const owner = owners.get(code);
      owners.delete(code);
      return owner;
    },
    issueCode(owner) {
      const code = randomUUID();
      owners.set(code, owner);
      return code;
    },
  };
}
