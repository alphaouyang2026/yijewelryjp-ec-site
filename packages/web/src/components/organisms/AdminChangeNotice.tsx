import { useMessages } from '../../i18n/useMessages';
import { Button } from '../atoms/Button';
import { Notice } from '../atoms/Notice';
import type { ChangeNotice } from '../../adminChanges';

/**
 * How the owner's last change on an admin page ended: `doneText` says what
 * was done, `staleText` that someone changed the data since it was loaded.
 * After a conflict it offers to load the latest (`onReload`).
 */
export function AdminChangeNotice<Done extends string>({
  notice,
  doneText,
  staleText,
  onReload,
}: {
  notice: ChangeNotice<Done> | null;
  doneText: Record<Done, string>;
  staleText: string;
  onReload: () => void;
}) {
  const text = useMessages().admin;
  if (!notice) return null;
  const problemText = {
    invalid: text.forms.invalid,
    failed: text.forms.failed,
    stale: staleText,
    invalidTransition: text.productActions.invalidTransition,
  };
  const conflict = notice.text === 'stale' || notice.text === 'invalidTransition';
  return (
    <Notice tone={notice.tone}>
      <span>{notice.tone === 'done' ? doneText[notice.text] : problemText[notice.text]}</span>
      {conflict && (
        <Button variant="secondary" onClick={onReload}>
          {text.forms.reload}
        </Button>
      )}
    </Notice>
  );
}
