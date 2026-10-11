import type { LoaderFunctionArgs } from 'react-router';
import { api } from '../../../../api';
import { localeOfPath } from '../../../../i18n/locales';

/** Every category, in the owner's order, named in the page's locale. */
export async function adminCategoriesLoader({ url }: LoaderFunctionArgs) {
  const res = await api.admin.categories.$get({ query: { locale: localeOfPath(url.pathname) } });
  if (!res.ok) throw new Error(`Admin category list request failed with status ${res.status}`);
  return res.json();
}
