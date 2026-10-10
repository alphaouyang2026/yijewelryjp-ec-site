import { useMatches } from 'react-router';
import { useMessages } from '../../../i18n/useMessages';
import { adminSectionOf } from '../../../paths';
import { AdminMessage } from '../../organisms/AdminMessage';

/** An admin section whose page a later ticket builds: its name and a placeholder until then. */
export function AdminSectionPage() {
  const text = useMessages().admin;
  const section = adminSectionOf(useMatches().at(-1)?.handle);
  if (!section) throw new Error('AdminSectionPage needs a route whose handle names its admin section');
  return <AdminMessage title={text.sections[section]} text={text.comingSoon} />;
}
