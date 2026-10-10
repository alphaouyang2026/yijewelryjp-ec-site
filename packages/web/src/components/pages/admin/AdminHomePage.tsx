import { useMessages } from '../../../i18n/useMessages';
import { AdminMessage } from '../../organisms/AdminMessage';

/** The admin's first page. */
export function AdminHomePage() {
  const text = useMessages().admin;
  return <AdminMessage title={text.title} text={text.welcome} />;
}
