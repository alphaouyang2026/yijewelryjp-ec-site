import { useState } from 'react';
import { useLoaderData } from 'react-router';
import { useAdminChanges } from '../../../../adminChanges';
import type { FieldErrors, LocalizedValues } from '../../../../adminForms';
import { api, type AdminCategory } from '../../../../api';
import type { Locale } from '../../../../i18n/locales';
import { useLocale } from '../../../../i18n/useLocale';
import { useMessages } from '../../../../i18n/useMessages';
import { AdminPageHeading } from '../../../molecules/AdminPageHeading';
import { AdminChangeNotice } from '../../../organisms/AdminChangeNotice';
import { CategoryCreateForm } from '../../../organisms/CategoryCreateForm';
import { CategoryList } from '../../../organisms/CategoryList';
import { useCsrfHeaders } from '../adminSession';
import type { adminCategoriesLoader } from './adminCategoriesLoader';

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
  const changes = useAdminChanges<'reordered' | 'saved' | 'added'>();
  const [formErrors, setFormErrors] = useState<FormErrors | null>(null);
  // A new key empties the new-category form once a category is added.
  const [createFormKey, setCreateFormKey] = useState(0);

  function move(index: number, direction: -1 | 1) {
    const order = categories.map(({ slug, version }) => ({ slug, version }));
    const [moved] = order.splice(index, 1);
    if (!moved) return;
    order.splice(index + direction, 0, moved);
    void changes.send(
      () => api.admin['category-order'].$put({ query: { locale }, json: { categories: order } }, { headers }),
      { done: 'reordered', onStored: () => setFormErrors(null) },
    );
  }

  function rename(category: AdminCategory, name: LocalizedValues) {
    void changes.send(
      () =>
        api.admin.categories[':slug'].$put(
          { param: { slug: category.slug }, json: { name, version: category.version } },
          { headers },
        ),
      {
        done: 'saved',
        onStored: () => setFormErrors(null),
        onInvalid: (errors) => setFormErrors({ form: 'rename', slug: category.slug, errors }),
      },
    );
  }

  function create(category: { slug: string; name: LocalizedValues }) {
    void changes.send(() => api.admin.categories.$post({ json: category }, { headers }), {
      done: 'added',
      onStored: () => {
        setFormErrors(null);
        setCreateFormKey((key) => key + 1);
      },
      onInvalid: (errors) => setFormErrors({ form: 'create', errors }),
    });
  }

  async function reload() {
    setFormErrors(null);
    await changes.reload();
  }

  const renameErrorsOf = (slug: string): Partial<Record<Locale, string>> => {
    if (formErrors?.form !== 'rename' || formErrors.slug !== slug) return {};
    const errorOf = (locale: Locale) => {
      const code = formErrors.errors[`name.${locale}`];
      return code && messages.fieldErrors[code];
    };
    return { ja: errorOf('ja'), zh: errorOf('zh'), en: errorOf('en') };
  };

  return (
    <>
      <AdminPageHeading title={messages.sections.categories} />
      <AdminChangeNotice
        notice={changes.notice}
        doneText={{ reordered: text.reordered, saved: text.saved, added: text.added }}
        staleText={text.stale}
        onReload={reload}
      />
      <CategoryList
        categories={categories}
        busy={changes.busy}
        renameErrorsOf={renameErrorsOf}
        onMove={move}
        onRename={rename}
      />
      <CategoryCreateForm
        key={createFormKey}
        errors={formErrors?.form === 'create' ? formErrors.errors : {}}
        busy={changes.busy}
        onCreate={create}
      />
    </>
  );
}
