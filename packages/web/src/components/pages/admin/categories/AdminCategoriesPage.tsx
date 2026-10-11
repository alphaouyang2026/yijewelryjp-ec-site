import { useState } from 'react';
import { useLoaderData, useRevalidator } from 'react-router';
import { fieldErrorsOf, type FieldErrors, type LocalizedValues } from '../../../../adminForms';
import { api, type AdminCategory, type InvalidInput } from '../../../../api';
import type { Locale } from '../../../../i18n/locales';
import { useLocale } from '../../../../i18n/useLocale';
import { useMessages } from '../../../../i18n/useMessages';
import { Button } from '../../../atoms/Button';
import { Notice } from '../../../atoms/Notice';
import { AdminPageHeading } from '../../../molecules/AdminPageHeading';
import { CategoryCreateForm } from '../../../organisms/CategoryCreateForm';
import { CategoryList } from '../../../organisms/CategoryList';
import { useCsrfHeaders } from '../adminSession';
import type { adminCategoriesLoader } from './adminCategoriesLoader';

type PageNotice =
  | { tone: 'done'; text: 'reordered' | 'saved' | 'added' }
  | { tone: 'problem'; text: 'invalid' | 'failed' | 'stale' };

/** Which form the API's field errors are for: the new-category form, or one category's rename. */
type FormErrors = { form: 'create'; errors: FieldErrors } | { form: 'rename'; slug: string; errors: FieldErrors };

/**
 * The categories: their order (which the store's navigation follows), each
 * one's names, and the form that adds one. Every change is sent with the
 * versions the page loaded; if someone changed the categories since, the page
 * says so and the owner loads the latest before trying again.
 */
export function AdminCategoriesPage() {
  const { categories } = useLoaderData<typeof adminCategoriesLoader>();
  const messages = useMessages().admin;
  const text = messages.categories;
  const locale = useLocale();
  const headers = useCsrfHeaders();
  const revalidator = useRevalidator();
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors | null>(null);
  const [busy, setBusy] = useState(false);
  // A new key empties the new-category form once a category is added.
  const [createFormKey, setCreateFormKey] = useState(0);

  /**
   * Sends a change, then shows how it ended; once it is stored, reloads the
   * categories. `errorsFor` says which form the API's field errors are for
   * (a reorder has no form: its 400 is just a failure).
   */
  async function send(
    request: () => Promise<Response>,
    done: 'reordered' | 'saved' | 'added',
    errorsFor?: (errors: FieldErrors) => FormErrors,
  ) {
    setBusy(true);
    try {
      const res = await request();
      if (res.ok) {
        setFormErrors(null);
        setNotice({ tone: 'done', text: done });
        if (done === 'added') setCreateFormKey((key) => key + 1);
        await revalidator.revalidate();
      } else if (res.status === 400 && errorsFor) {
        setFormErrors(errorsFor(fieldErrorsOf((await res.json()) as InvalidInput)));
        setNotice({ tone: 'problem', text: 'invalid' });
      } else {
        setNotice({ tone: 'problem', text: res.status === 409 ? 'stale' : 'failed' });
      }
    } catch {
      setNotice({ tone: 'problem', text: 'failed' });
    }
    setBusy(false);
  }

  function move(index: number, direction: -1 | 1) {
    const order = categories.map(({ slug, version }) => ({ slug, version }));
    const [moved] = order.splice(index, 1);
    if (!moved) return;
    order.splice(index + direction, 0, moved);
    void send(
      () => api.admin['category-order'].$put({ query: { locale }, json: { categories: order } }, { headers }),
      'reordered',
    );
  }

  function rename(category: AdminCategory, name: LocalizedValues) {
    void send(
      () =>
        api.admin.categories[':slug'].$put(
          { param: { slug: category.slug }, json: { name, version: category.version } },
          { headers },
        ),
      'saved',
      (errors) => ({ form: 'rename', slug: category.slug, errors }),
    );
  }

  function create(category: { slug: string; name: LocalizedValues }) {
    void send(() => api.admin.categories.$post({ json: category }, { headers }), 'added', (errors) => ({
      form: 'create',
      errors,
    }));
  }

  async function reload() {
    setNotice(null);
    setFormErrors(null);
    await revalidator.revalidate();
  }

  const renameErrorsOf = (slug: string): Partial<Record<Locale, string>> => {
    if (formErrors?.form !== 'rename' || formErrors.slug !== slug) return {};
    const errorOf = (locale: Locale) => {
      const code = formErrors.errors[`name.${locale}`];
      return code && messages.fieldErrors[code];
    };
    return { ja: errorOf('ja'), zh: errorOf('zh'), en: errorOf('en') };
  };

  const noticeText = {
    reordered: text.reordered,
    saved: text.saved,
    added: text.added,
    invalid: messages.forms.invalid,
    failed: messages.forms.failed,
    stale: text.stale,
  };

  return (
    <>
      <AdminPageHeading title={messages.sections.categories} />
      {notice && (
        <Notice tone={notice.tone}>
          <span>{noticeText[notice.text]}</span>
          {notice.text === 'stale' && (
            <Button variant="secondary" onClick={reload}>
              {messages.forms.reload}
            </Button>
          )}
        </Notice>
      )}
      <CategoryList
        categories={categories}
        busy={busy}
        renameErrorsOf={renameErrorsOf}
        onMove={move}
        onRename={rename}
      />
      <CategoryCreateForm
        key={createFormKey}
        errors={formErrors?.form === 'create' ? formErrors.errors : {}}
        busy={busy}
        onCreate={create}
      />
    </>
  );
}
