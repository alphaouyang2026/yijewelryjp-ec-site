import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/dist', '**/.vitest', '**/coverage']),
  {
    files: ['**/*.{js,ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  {
    files: ['eslint.config.js', 'packages/api/**/*.ts', 'packages/*/vite*.config.ts', 'packages/*/vitest*.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['packages/web/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite()],
    languageOptions: { globals: globals.browser },
    rules: {
      // The web app uses the API's route types (Hono RPC) but never its runtime code.
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@yi/api',
              allowTypeImports: true,
              message: 'Import only types from @yi/api (`import type`).',
            },
          ],
          patterns: [
            {
              group: ['@yi/api/*', '**/api/src/**'],
              message: 'Import API types from @yi/api only.',
            },
          ],
        },
      ],
    },
  },
]);
