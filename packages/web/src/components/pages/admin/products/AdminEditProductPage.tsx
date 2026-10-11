import { useState } from 'react';
import { useLoaderData, useLocation, useRevalidator } from 'react-router';
import { fieldErrorsOf, productContent, productValues, type FieldErrors, type ProductFormValues } from '../../../../adminForms';
import { api } from '../../../../api';
import { useMessages } from '../../../../i18n/useMessages';
import { paths } from '../../../../paths';
import { Button } from '../../../atoms/Button';
import { LocalizedLink } from '../../../atoms/LocalizedLink';
import { Notice } from '../../../atoms/Notice';
import { AdminPageHeading } from '../../../molecules/AdminPageHeading';
import { ProductForm } from '../../../organisms/ProductForm';
import { ProductStatusPanel, type StatusChange } from '../../../organisms/ProductStatusPanel';
import { useCsrfHeaders } from '../adminSession';
import type { adminEditProductLoader } from './adminProductLoaders';

/** What the page was opened with: 'created' when the owner just created the product. */
export type EditPageState = { notice?: 'created' };

/** What the page tells the owner after a change: done, or why nothing changed. */
type PageNotice =
  | { tone: 'done'; text: 'created' | 'saved' | 'statusChanged' }
  | { tone: 'problem'; text: 'invalid' | 'failed' | 'stale' | 'invalidTransition' };

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
  const revalidator = useRevalidator();
  const opened = useLocation().state as EditPageState | null;
  const [notice, setNotice] = useState<PageNotice | null>(
    opened?.notice === 'created' ? { tone: 'done', text: 'created' } : null,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
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

  /** Sends a change, then shows how it ended; once it is stored, reloads the product. */
  async function send(request: () => Promise<Response>, done: 'saved' | 'statusChanged') {
    setBusy(true);
    try {
      const res = await request();
      const body: unknown = await res.json();
      if (res.ok) {
        setErrors({});
        setNotice({ tone: 'done', text: done });
        if (done === 'statusChanged') setStatusChangedVersion((body as { version: number }).version);
        await revalidator.revalidate();
      } else if (res.status === 400) {
        setErrors(fieldErrorsOf(body as Parameters<typeof fieldErrorsOf>[0]));
        setNotice({ tone: 'problem', text: 'invalid' });
      } else if (res.status === 409) {
        const error = (body as { error?: string }).error;
        setNotice({ tone: 'problem', text: error === 'stale_version' ? 'stale' : 'invalidTransition' });
      } else {
        setNotice({ tone: 'problem', text: 'failed' });
      }
    } catch {
      setNotice({ tone: 'problem', text: 'failed' });
    }
    setBusy(false);
  }

  const param = { slug: product.slug };
  const save = (values: ProductFormValues) =>
    send(
      () => api.admin.products[':slug'].$put({ param, json: { ...productContent(values), version: product.version } }, { headers }),
      'saved',
    );
  const changeStatus = (change: StatusChange) =>
    send(
      () => api.admin.products[':slug'][change].$post({ param, json: { version: product.version } }, { headers }),
      'statusChanged',
    );

  async function reload() {
    setNotice(null);
    setErrors({});
    await revalidator.revalidate();
  }

  const noticeText = {
    created: text.productForm.created,
    saved: text.productForm.saved,
    statusChanged: text.productActions.changed,
    invalid: text.forms.invalid,
    failed: text.forms.failed,
    stale: text.productForm.stale,
    invalidTransition: text.productActions.invalidTransition,
  };

  return (
    <>
      <AdminPageHeading title={text.productForm.editTitle}>
        <LocalizedLink to={paths.adminProducts()} variant="buttonOutline">
          {text.productForm.backToList}
        </LocalizedLink>
      </AdminPageHeading>
      {notice && (
        <Notice tone={notice.tone}>
          <span>{noticeText[notice.text]}</span>
          {(notice.text === 'stale' || notice.text === 'invalidTransition') && (
            <Button variant="secondary" onClick={reload}>
              {text.forms.reload}
            </Button>
          )}
        </Notice>
      )}
      <ProductStatusPanel
        status={product.status}
        statusChanges={product.statusChanges}
        busy={busy}
        onChange={changeStatus}
      />
      <ProductForm
        key={formKey}
        mode="edit"
        initial={productValues(product)}
        categories={categories}
        errors={errors}
        submitting={busy}
        onSubmit={save}
      />
    </>
  );
}
