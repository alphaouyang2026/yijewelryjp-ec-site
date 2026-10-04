import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server';

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  // The locale root sets <html lang>; clear it so each test sees only its own page's.
  document.documentElement.removeAttribute('lang');
});

afterAll(() => {
  server.close();
});
