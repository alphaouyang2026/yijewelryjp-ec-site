import { Hono } from 'hono';
import { localeQuery } from '../../platform/locale-query';
import type { GetHomeData } from '../application/get-home-data';

export function homeRoutes(getHomeData: GetHomeData) {
  return new Hono().get('/', localeQuery, async (c) => {
    const { locale } = c.req.valid('query');
    return c.json(await getHomeData(locale), 200);
  });
}
