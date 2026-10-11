import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // The local API (packages/api `npm run dev`); in production CloudFront routes /api/* the same way.
    // The API's server also stands in for the photo bucket: uploads (/local-s3) and photos (/images).
    proxy: {
      '/api': 'http://127.0.0.1:8787',
      '/local-s3': 'http://127.0.0.1:8787',
      '/images': 'http://127.0.0.1:8787',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
  },
});
