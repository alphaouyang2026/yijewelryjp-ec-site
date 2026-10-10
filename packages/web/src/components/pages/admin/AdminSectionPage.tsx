import { useMatches } from 'react-router';
import { useMessages } from '../../../i18n/useMessages';
import type { AdminSection } from '../../../paths';
import { AdminMessage } from '../../organisms/AdminMessage';

/** An admin section whose page a later ticket builds: its name and a placeholder until then. */
export function AdminSectionPage() {
  const text = useMessages().admin;
  const { adminSection } = useMatches().at(-1)?.handle as { adminSection: AdminSection };
  return <AdminMessage title={text.sections[adminSection]} text={text.comingSoon} />;
}
