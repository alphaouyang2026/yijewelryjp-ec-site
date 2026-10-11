import { data, type LoaderFunctionArgs } from 'react-router';
import { api } from '../../../../api';
import { localeOfPath, type Locale } from '../../../../i18n/locales';

/** The categories a product can be in, named in `locale`, in the owner's order. */
async function categoryChoices(locale: Locale) {
  const res = await api.admin.categories.$get({ query: { locale } });
  if (!res.ok) throw new Error(`Admin category list request failed with status ${res.status}`);
  return (await res.json()).categories.map((category) => ({ slug: category.slug, name: category.displayName }));
}

/** What the new-product form needs: the categories to choose from. */
export async function adminNewProductLoader({ url }: LoaderFunctionArgs) {
  return { categories: await categoryChoices(localeOfPath(url.pathname)) };
}

/** The product to edit (the admin's error page if there is none), and the categories to choose from. */
export async function adminEditProductLoader({ url, params }: LoaderFunctionArgs) {
  const [res, categories] = await Promise.all([
    api.admin.products[':slug'].$get({ param: { slug: params.slug ?? '' } }),
    categoryChoices(localeOfPath(url.pathname)),
  ]);
  // The admin guard's 401 is not in the route's types; any status but 200 and 404 is a failure.
  const status: number = res.status;
  if (status === 404) throw data(null, { status: 404 });
  if (!res.ok) throw new Error(`Admin product request failed with status ${status}`);
  return { product: await res.json(), categories };
}
