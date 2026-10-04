import { api } from '../../api';

export async function homeLoader() {
  const res = await api.home.$get({ query: { locale: 'ja' } });
  if (!res.ok) throw new Error(`Home data request failed with status ${res.status}`);
  return res.json();
}
