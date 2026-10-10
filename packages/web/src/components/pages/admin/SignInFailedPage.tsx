import { BRAND_NAME } from '../../../brand';
import { useMessages } from '../../../i18n/useMessages';
import { paths } from '../../../paths';
import { AdminMessage } from '../../organisms/AdminMessage';
import { AdminLayout } from '../../templates/AdminLayout';

/**
 * Where the API sends the browser when signing in did not complete (the owner
 * cancelled, took too long, or the identity provider refused). It needs no
 * session, so it cannot send the browser to sign in again by itself; the
 * owner tries again from its link to the admin.
 */
export function SignInFailedPage() {
  const text = useMessages().admin.signInFailed;
  return (
    <AdminLayout>
      <title>{`${text.title} | ${BRAND_NAME}`}</title>
      <meta name="robots" content="noindex" />
      <AdminMessage title={text.title} text={text.text} link={{ to: paths.admin, text: text.retry }} />
    </AdminLayout>
  );
}
