import type { LoaderFunctionArgs } from 'react-router';
import { api } from '../../../api';
import { localeOfPath } from '../../../i18n/locales';

export async function homeLoader({ url }: LoaderFunctionArgs) {
  const res = await api.home.$get({ query: { locale: localeOfPath(url.pathname) } });
  if (!res.ok) throw new Error(`Home data request failed with status ${res.status}`);
  return res.json();
}
