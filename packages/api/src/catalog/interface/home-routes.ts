import { Hono } from 'hono';
import { PUBLIC_CATALOG_CACHE } from '../../interface/cache-control';
import { localeQuery } from '../../interface/locale-query';
import type { GetHomeData } from '../application/get-home-data';

export function homeRoutes(getHomeData: GetHomeData) {
  return new Hono().get('/', localeQuery, async (c) => {
    const { locale } = c.req.valid('query');
    c.header('Cache-Control', PUBLIC_CATALOG_CACHE);
    return c.json(await getHomeData(locale), 200);
  });
}
