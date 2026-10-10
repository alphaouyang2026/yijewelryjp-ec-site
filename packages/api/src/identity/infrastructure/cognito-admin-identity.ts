import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { Locale } from '../../shared-kernel/locale';
import type { AdminIdentity } from '../domain/admin-identity';
import type { Owner } from '../domain/owner';
import type { AdminReturnUrls } from './admin-urls';

export type CognitoSettings = {
  /** The user pool's managed login domain, e.g. https://yijewelry-staging-123456789012.auth.ap-northeast-1.amazoncognito.com */
  domainUrl: string;
  userPoolId: string;
  /** The confidential app client (authorization code grant) and its secret. */
  clientId: string;
  clientSecret: string;
  returnUrls: AdminReturnUrls;
};

/** Managed login's language codes for the site's locales. */
const MANAGED_LOGIN_LANG: Record<Locale, string> = { ja: 'ja', zh: 'zh-CN', en: 'en' };

/**
 * AdminIdentity on Cognito's managed login, with the authorization code grant:
 * the API exchanges the code at the token endpoint (authenticating with the
 * client secret) and verifies the ID token's signature against the user pool's
 * JWKS, its issuer, audience (the app client) and expiry. The tokens are used
 * only here; the browser never sees them.
 */
export function cognitoAdminIdentity(settings: CognitoSettings): AdminIdentity {
  const { domainUrl, userPoolId, clientId, clientSecret, returnUrls } = settings;
  const idTokens = CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: 'id' });

  return {
    signInUrl({ state, locale }) {
      const query = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: returnUrls.callbackUrl,
        scope: 'openid email',
        state,
        lang: MANAGED_LOGIN_LANG[locale],
      });
      return `${domainUrl}/oauth2/authorize?${query}`;
    },

    async ownerForCode(code) {
      const res = await fetch(`${domainUrl}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: returnUrls.callbackUrl }),
      });
      if (!res.ok) {
        // invalid_grant: a code that was used, expired (5 minutes) or never issued.
        console.warn('Cognito refused the authorization code', { status: res.status, body: await res.text() });
        return undefined;
      }

      const { id_token: idToken } = (await res.json()) as { id_token?: string };
      if (!idToken) return undefined;
      try {
        const payload = await idTokens.verify(idToken);
        return ownerFrom(payload);
      } catch (error) {
        console.warn('Cognito ID token failed verification', error);
        return undefined;
      }
    },

    signOutUrl(locale) {
      const query = new URLSearchParams({ client_id: clientId, logout_uri: returnUrls.signedOutUrl(locale) });
      return `${domainUrl}/logout?${query}`;
    },
  };
}

function ownerFrom(payload: { sub: string; email?: unknown }): Owner | undefined {
  return typeof payload.email === 'string' ? { id: payload.sub, email: payload.email } : undefined;
}
