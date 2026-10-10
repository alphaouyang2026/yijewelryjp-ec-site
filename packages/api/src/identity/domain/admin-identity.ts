import type { Locale } from '../../shared-kernel/locale';
import type { Owner } from './owner';

/**
 * The identity provider owners sign in with (production: Cognito's managed
 * login). It runs the sign-in pages; the API only sends the browser there and
 * exchanges what comes back for a verified owner.
 */
export interface AdminIdentity {
  /**
   * Where to send the browser to sign in, with its pages in `locale`. After
   * signing in, the provider sends the browser to the API's sign-in callback
   * with an authorization code and `state`.
   */
  signInUrl(request: { state: string; locale: Locale }): string;

  /** The owner who signed in and got `code`; undefined if the code is not one the provider issued, or was used. */
  ownerForCode(code: string): Promise<Owner | undefined>;

  /**
   * Where to send the browser to end the provider's own sign-in session too,
   * so the next sign-in asks for the password and code again. The provider
   * then sends the browser to the store's home page in `locale`.
   */
  signOutUrl(locale: Locale): string;
}
