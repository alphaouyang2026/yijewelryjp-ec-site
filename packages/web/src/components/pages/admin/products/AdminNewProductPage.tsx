import { useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router';
import { blankProduct, fieldErrorsOf, productContent, type FieldErrors, type ProductFormValues } from '../../../../adminForms';
import { api } from '../../../../api';
import { localizedPath } from '../../../../i18n/locales';
import { useLocale } from '../../../../i18n/useLocale';
import { useMessages } from '../../../../i18n/useMessages';
import { paths } from '../../../../paths';
import { LocalizedLink } from '../../../atoms/LocalizedLink';
import { Notice } from '../../../atoms/Notice';
import { AdminPageHeading } from '../../../molecules/AdminPageHeading';
import { ProductForm } from '../../../organisms/ProductForm';
import { useCsrfHeaders } from '../adminSession';
import type { adminNewProductLoader } from './adminProductLoaders';
import type { EditPageState } from './AdminEditProductPage';

/**
 * The new-product form. The product is created as a draft; the owner then
 * goes on to its edit page, where it can be listed.
 */
export function AdminNewProductPage() {
  const { categories } = useLoaderData<typeof adminNewProductLoader>();
  const text = useMessages().admin.productForm;
  const headers = useCsrfHeaders();
  const navigate = useNavigate();
  const locale = useLocale();
  const [initial] = useState(blankProduct);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<'invalid' | 'failed' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function create(values: ProductFormValues) {
    setSubmitting(true);
    try {
      const res = await api.admin.products.$post({ json: { slug: values.slug, ...productContent(values) } }, { headers });
      if (res.status === 201) {
        const state: EditPageState = { notice: 'created' };
        await navigate(localizedPath(locale, paths.adminEditProduct((await res.json()).slug)), { state });
        return;
      }
      if (res.status === 400) {
        setErrors(fieldErrorsOf(await res.json()));
        setProblem('invalid');
      } else {
        setProblem('failed');
      }
    } catch {
      setProblem('failed');
    }
    setSubmitting(false);
  }

  return (
    <>
      <AdminPageHeading title={text.newTitle}>
        <LocalizedLink to={paths.adminProducts()} variant="buttonOutline">
          {text.backToList}
        </LocalizedLink>
      </AdminPageHeading>
      {problem && <Notice tone="problem">{text[problem]}</Notice>}
      <ProductForm
        mode="new"
        initial={initial}
        categories={categories}
        errors={errors}
        submitting={submitting}
        onSubmit={create}
      />
    </>
  );
}
