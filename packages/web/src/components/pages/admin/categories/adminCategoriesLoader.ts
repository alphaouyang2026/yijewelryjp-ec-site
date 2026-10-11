import type { LoaderFunctionArgs } from 'react-router';
import { api, type AdminCategoryList } from '../../../../api';
import { localeOfPath, type Locale } from '../../../../i18n/locales';

/** Every category, in the owner's order, named in `locale`, as the admin edits them. */
export async function fetchAdminCategories(locale: Locale): Promise<AdminCategoryList> {
  const res = await api.admin.categories.$get({ query: { locale } });
  if (!res.ok) throw new Error(`Admin category list request failed with status ${res.status}`);
  return res.json();
}

/** Every category, in the owner's order, named in the page's locale. */
export async function adminCategoriesLoader({ url }: LoaderFunctionArgs) {
  return fetchAdminCategories(localeOfPath(url.pathname));
}
