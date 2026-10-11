import { useId, useState, type FormEvent } from 'react';
import { blankText, type FieldErrors, type LocalizedValues } from '../../adminForms';
import { useMessages } from '../../i18n/useMessages';
import { Button } from '../atoms/Button';
import { TextInput } from '../atoms/TextInput';
import { FormField } from '../molecules/FormField';
import { LocalizedTextField } from '../molecules/LocalizedTextField';
import styles from './CategoryCreateForm.module.css';

/**
 * The form that adds a category: its slug and its name per locale. `errors`
 * are the API's field errors for the last attempt, shown next to each field.
 */
export function CategoryCreateForm({
  errors,
  busy,
  onCreate,
}: {
  errors: FieldErrors;
  busy: boolean;
  onCreate: (category: { slug: string; name: LocalizedValues }) => void;
}) {
  const messages = useMessages().admin;
  const text = messages.categories;
  const headingId = useId();
  const [slug, setSlug] = useState('');
  const [name, setName] = useState(blankText);
  const errorOf = (path: string) => {
    const code = errors[path];
    return code && messages.fieldErrors[code];
  };

  function create(event: FormEvent) {
    event.preventDefault();
    onCreate({ slug, name });
  }

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.title}>
        {text.addTitle}
      </h2>
      <form noValidate onSubmit={create} className={styles.form}>
        <FormField label={messages.productForm.slug} hint={messages.productForm.slugHint} error={errorOf('slug')}>
          {(control) => (
            <TextInput
              {...control}
              autoCapitalize="off"
              spellCheck={false}
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          )}
        </FormField>
        <LocalizedTextField
          label={text.name}
          required
          value={name}
          onChange={setName}
          errors={{ ja: errorOf('name.ja'), zh: errorOf('name.zh'), en: errorOf('name.en') }}
        />
        <Button type="submit" variant="primary" disabled={busy} className={styles.submit}>
          {text.add}
        </Button>
      </form>
    </section>
  );
}
