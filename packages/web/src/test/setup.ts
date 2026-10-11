import '@testing-library/jest-dom/vitest';
import { File as NodeFile } from 'node:buffer';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server';

beforeAll(async () => {
  server.listen({ onUnhandledFrame: 'error' });
  await sendJsdomFormsWithNodeFetch();
});

/**
 * Pages post forms with files (photo uploads) with fetch, as browsers do. In
 * the tests, fetch is Node's but FormData and File are jsdom's, which Node's
 * fetch cannot send; so forms are copied into Node's FormData and File first.
 * Installed over MSW's fetch, so the handlers read the forms as sent.
 */
async function sendJsdomFormsWithNodeFetch() {
  const fetchOverMsw = globalThis.fetch;
  // Node's FormData is the global jsdom replaced; a Response still makes one.
  const NodeFormData = (await new Response(new URLSearchParams()).formData()).constructor as typeof FormData;
  globalThis.fetch = async (input, init) => {
    if (!(init?.body instanceof FormData)) return fetchOverMsw(input, init);
    const body = new NodeFormData();
    for (const [name, value] of init.body) {
      const copied =
        typeof value === 'string'
          ? value
          : new NodeFile([new Uint8Array(await value.arrayBuffer())], value.name, { type: value.type });
      body.append(name, copied as string | Blob);
    }
    return fetchOverMsw(input, { ...init, body });
  };
}

afterEach(() => {
  cleanup();
  server.resetHandlers();
  // The locale root sets <html lang>; clear it so each test sees only its own page's.
  document.documentElement.removeAttribute('lang');
});

afterAll(() => {
  server.close();
});
