import { expect, test } from 'vitest';
import { useTestApi } from './support/test-api';

const api = useTestApi();

test('a test client sends back the cookies the API set on it, while a new client starts without any', async () => {
  const client = api.client();

  await client.api._test.cookie.$post();
  const res = await client.api._test.cookie.$get();
  expect(await res.json()).toEqual({ cookie: 'probe=set-by-api' });

  const fresh = await api.client().api._test.cookie.$get();
  expect(await fresh.json()).toEqual({ cookie: null });
});
