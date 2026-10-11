import { useState, type FormEvent } from 'react';
import { sameText, textValues, type LocalizedValues } from '../../adminForms';
import type { AdminCategory } from '../../api';
import type { Locale } from '../../i18n/locales';
import { useMessages } from '../../i18n/useMessages';
import { Button } from '../atoms/Button';
import { LocalizedTextField } from './LocalizedTextField';
import styles from './CategoryItem.module.css';

/**
 * One category in the admin's ordered list: its name and slug, buttons to
 * move it up or down (none past either end), and its names per locale to
 * rename it. `errors` are the API's errors for its rename, per locale.
 */
export function CategoryItem({
  category,
  first,
  last,
  busy,
  errors,
  onMove,
  onRename,
}: {
  category: AdminCategory;
  first: boolean;
  last: boolean;
  busy: boolean;
  errors: Partial<Record<Locale, string>>;
  onMove: (direction: -1 | 1) => void;
  onRename: (name: LocalizedValues) => void;
}) {
  const text = useMessages().admin.categories;
  const stored = textValues(category.name);
  const [name, setName] = useState(stored);
  // When the stored names change (renamed here or elsewhere), the fields start
  // afresh from them; a new version that only moved the category keeps what
  // the owner is typing.
  const [shown, setShown] = useState(stored);
  if (!sameText(shown, stored)) {
    setShown(stored);
    setName(stored);
  }

  function rename(event: FormEvent) {
    event.preventDefault();
    onRename(name);
  }

  return (
    <div className={styles.item}>
      <div className={styles.header}>
        <h3 className={styles.name}>{category.displayName}</h3>
        <code className={styles.slug}>{category.slug}</code>
        <div className={styles.moves}>
          <Button variant="secondary" disabled={busy || first} onClick={() => onMove(-1)}>
            {text.moveUp(category.displayName)}
          </Button>
          <Button variant="secondary" disabled={busy || last} onClick={() => onMove(1)}>
            {text.moveDown(category.displayName)}
          </Button>
        </div>
      </div>
      <form noValidate onSubmit={rename} className={styles.rename}>
        <LocalizedTextField
          label={text.rename(category.displayName)}
          required
          value={name}
          onChange={setName}
          errors={errors}
        />
        <Button type="submit" variant="secondary" disabled={busy} className={styles.save}>
          {text.save}
        </Button>
      </form>
    </div>
  );
}
