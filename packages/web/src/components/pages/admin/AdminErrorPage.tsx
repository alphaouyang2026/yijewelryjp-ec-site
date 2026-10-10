import { BRAND_NAME } from '../../../brand';
import { useMessages } from '../../../i18n/useMessages';
import { paths } from '../../../paths';
import { AdminMessage } from '../../organisms/AdminMessage';
import { AdminLayout } from '../../templates/AdminLayout';

/**
 * The admin's error boundary: shown when an admin page cannot be shown, for
 * example while the API is unavailable. It stays in the admin's light frame
 * (without the session's navigation, which may be what failed) and offers a
 * way back to the admin's first page.
 */
export function AdminErrorPage() {
  const text = useMessages().admin.error;
  return (
    <AdminLayout>
      <title>{`${text.title} | ${BRAND_NAME}`}</title>
      <meta name="robots" content="noindex" />
      <AdminMessage title={text.title} text={text.text} link={{ to: paths.admin, text: text.home }} />
    </AdminLayout>
  );
}
