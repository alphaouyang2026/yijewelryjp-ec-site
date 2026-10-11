import { useState } from 'react';
import { useLoaderData, useLocation } from 'react-router';
import { useAdminChanges } from '../../../../adminChanges';
import { productContent, productValues, type FieldErrors, type ProductFormValues } from '../../../../adminForms';
import { api } from '../../../../api';
import { useMessages } from '../../../../i18n/useMessages';
import { paths } from '../../../../paths';
import { LocalizedLink } from '../../../atoms/LocalizedLink';
import { AdminPageHeading } from '../../../molecules/AdminPageHeading';
import { AdminChangeNotice } from '../../../organisms/AdminChangeNotice';
import { ProductForm } from '../../../organisms/ProductForm';
import { ProductStatusPanel, type StatusChange } from '../../../organisms/ProductStatusPanel';
import { useCsrfHeaders } from '../adminSession';
import type { adminEditProductLoader } from './adminProductLoaders';

/** What the page was opened with: 'created' when the owner just created the product. */
export type EditPageState = { notice?: 'created' };

/**
 * A product's edit page: its sales status with the status changes it allows,
 * and the product form. Every change is sent with the version the page loaded;
 * if someone changed the product since, the page says so and the owner loads
 * the latest version (which resets the form) before trying again.
 */
export function AdminEditProductPage() {
  const { product, categories } = useLoaderData<typeof adminEditProductLoader>();
  const text = useMessages().admin;
  const headers = useCsrfHeaders();
  const opened = useLocation().state as EditPageState | null;
  const changes = useAdminChanges<'created' | 'saved' | 'statusChanged'>(
    opened?.notice === 'created' ? { tone: 'done', text: 'created' } : null,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  // A new version of the product (saved, or loaded after a conflict) starts
  // the form afresh from it, except the version a status change made: that
  // changed only the status, so the form keeps what the owner is typing.
  const [formKey, setFormKey] = useState(product.version);
  const [shownVersion, setShownVersion] = useState(product.version);
  const [statusChangedVersion, setStatusChangedVersion] = useState<number | null>(null);
  if (product.version !== shownVersion) {
    setShownVersion(product.version);
    if (product.version !== statusChangedVersion) setFormKey(product.version);
  }

  const param = { slug: product.slug };
  const save = (values: ProductFormValues) =>
    changes.send(
      () => api.admin.products[':slug'].$put({ param, json: { ...productContent(values), version: product.version } }, { headers }),
      { done: 'saved', onStored: () => setErrors({}), onInvalid: setErrors },
    );
  const changeStatus = (change: StatusChange) =>
    changes.send(
      () => api.admin.products[':slug'][change].$post({ param, json: { version: product.version } }, { headers }),
      { done: 'statusChanged', onStored: (stored) => setStatusChangedVersion((stored as { version: number }).version) },
    );

  async function reload() {
    setErrors({});
    await changes.reload();
  }

  return (
    <>
      <AdminPageHeading title={text.productForm.editTitle}>
        <LocalizedLink to={paths.adminProducts()} variant="buttonOutline">
          {text.productForm.backToList}
        </LocalizedLink>
      </AdminPageHeading>
      <AdminChangeNotice
        notice={changes.notice}
        doneText={{
          created: text.productForm.created,
          saved: text.productForm.saved,
          statusChanged: text.productActions.changed,
        }}
        staleText={text.productForm.stale}
        onReload={reload}
      />
      <ProductStatusPanel
        status={product.status}
        statusChanges={product.statusChanges}
        busy={changes.busy}
        onChange={changeStatus}
      />
      <ProductForm
        key={formKey}
        mode="edit"
        initial={productValues(product)}
        categories={categories}
        errors={errors}
        submitting={changes.busy}
        onSubmit={save}
      />
    </>
  );
}
