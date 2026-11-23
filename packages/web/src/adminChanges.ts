import { useState } from 'react';
import { useRevalidator } from 'react-router';
import { fieldErrorsOf, type FieldErrors } from './adminForms';
import type { InvalidInput } from './api';

/** Why an admin change changed nothing: invalid input, a failure, an outdated version, or a status change not allowed. */
export type ChangeProblem = 'invalid' | 'failed' | 'stale' | 'invalidTransition';

/** What an admin page tells the owner after a change: which change was `Done`, or why nothing changed. */
export type ChangeNotice<Done extends string> =
  | { tone: 'done'; text: Done }
  | { tone: 'problem'; text: ChangeProblem };

/**
 * How an admin page sends changes to the API and tells the owner how they
 * ended. While a change is on its way the page is `busy`; once it is stored,
 * the page's loader data is reloaded. `initial` is a notice to show from the
 * start (say, that the item was just created).
 */
export function useAdminChanges<Done extends string>(initial: ChangeNotice<Done> | null = null) {
  const revalidator = useRevalidator();
  const [notice, setNotice] = useState(initial);
  const [busy, setBusy] = useState(false);

  /**
   * Sends a change with `request`, and shows how it ended: `done`, or why
   * nothing changed. Once it is stored, `onStored` gets the API's answer
   * before the data is reloaded; `succeeded`, if given, tells by the answer
   * whether the change did what was asked (say, an email the API could not
   * send), and if not the notice says it failed. A 400's field errors go to
   * `onInvalid`; without it, a 400 is a failure (there is no field to show them by).
   */
  async function send(
    request: () => Promise<Response>,
    {
      done,
      onStored,
      succeeded,
      onInvalid,
    }: {
      done: Done;
      onStored?: (stored: unknown) => void;
      succeeded?: (stored: unknown) => boolean;
      onInvalid?: (errors: FieldErrors) => void;
    },
  ) {
    setBusy(true);
    try {
      const res = await request();
      if (res.ok) {
        const stored: unknown = await res.json();
        onStored?.(stored);
        setNotice(succeeded && !succeeded(stored) ? { tone: 'problem', text: 'failed' } : { tone: 'done', text: done });
        await revalidator.revalidate();
      } else if (res.status === 400 && onInvalid) {
        onInvalid(fieldErrorsOf((await res.json()) as InvalidInput));
        setNotice({ tone: 'problem', text: 'invalid' });
      } else if (res.status === 409) {
        const { error } = (await res.json()) as { error?: string };
        setNotice({ tone: 'problem', text: error === 'invalid_status_transition' ? 'invalidTransition' : 'stale' });
      } else {
        setNotice({ tone: 'problem', text: 'failed' });
      }
    } catch {
      setNotice({ tone: 'problem', text: 'failed' });
    }
    setBusy(false);
  }

  /** Clears the notice and loads the latest data, as the owner asks after a conflict. */
  async function reload() {
    setNotice(null);
    await revalidator.revalidate();
  }

  return { notice, busy, send, reload };
}
