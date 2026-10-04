import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Matches an import source that has one of `names` as a whole path segment. */
const segment = (...names) => `(^|/)(${names.join('|')})(/|$)`;

/** A no-restricted-imports pattern: imports whose source matches `regex` are reported with `message`. */
const forbid = (regex, message, options = {}) => ({ regex, message, caseSensitive: true, ...options });

// ---------------------------------------------------------------------------
// API (packages/api/src): DDD layers. See docs/adr/0002-backend-ddd-layers.md.
//
// Each bounded context, and the operations module, has the layers
// domain <- application <- interface, with infrastructure implementing the
// domain's interfaces. Contexts use each other only through the other
// context's application layer. The composition root (app.ts,
// dynamodb-adapters.ts) and the entry points (local.ts, lambda.ts) sit outside
// the layers and may import anything.
// ---------------------------------------------------------------------------

const API_CONTEXTS = ['catalog', 'ordering', 'store', 'identity'];
const API_MODULES = [...API_CONTEXTS, 'operations'];

const FRAMEWORKS = '^(hono|zod)(/|$)|^@hono/|^@aws-sdk/';
const COMPOSITION_ROOT = forbid(
  '^(\\.\\./)+(app|dynamodb-adapters|local|lambda|index)$',
  'Only the entry points assemble the API; layers never import the composition root.',
);
const DYNAMODB_LOCAL = forbid(
  '(^|/)dynamodb-local$',
  'DynamoDB Local is for local development and tests only; production code never loads it.',
);

const apiLayerRules = {
  domain: [
    forbid(segment('application', 'infrastructure', 'interface'), 'The domain layer depends on no other layer.'),
    forbid(segment('platform'), 'The domain layer uses no technical building blocks.'),
    forbid(FRAMEWORKS, 'The domain layer uses no framework, validation library or AWS SDK.'),
  ],
  application: [
    forbid(
      segment('infrastructure', 'interface', 'platform'),
      'The application layer depends on the domain layer only; adapters are injected.',
    ),
    forbid(FRAMEWORKS, 'The application layer uses no framework, validation library or AWS SDK.'),
  ],
  infrastructure: [
    forbid(segment('application', 'interface'), 'Infrastructure implements interfaces from the domain layer.'),
    forbid('^(hono|zod)(/|$)|^@hono/', 'HTTP and request validation belong in the interface layer.'),
  ],
  interface: [
    forbid(segment('domain', 'infrastructure'), 'The interface layer calls the application layer only.'),
    forbid('^@aws-sdk/|(^|/)platform/dynamodb$', 'AWS calls belong in the infrastructure layer.'),
  ],
};

/** Rules about other modules: only an application layer may use another context, and only its application layer. */
function otherModuleRules(module, layer) {
  const others = API_MODULES.filter((other) => other !== module).join('|');
  return layer === 'application'
    ? [
        forbid(
          `(^|/)(${others})/(domain|infrastructure|interface)(/|$)`,
          'Contexts use each other only through the other context’s application layer.',
        ),
      ]
    : [forbid(`(^|/)(${others})(/|$)`, 'Only the application layer may use another context (its application layer).')];
}

const apiLayerConfigs = API_MODULES.flatMap((module) =>
  Object.entries(apiLayerRules).map(([layer, rules]) => ({
    files: [`packages/api/src/${module}/${layer}/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...rules, ...otherModuleRules(module, layer), COMPOSITION_ROOT, DYNAMODB_LOCAL] },
      ],
    },
  })),
);

const apiSharedConfigs = [
  {
    // The composition root and the Lambda entry point; local.ts may use DynamoDB Local.
    files: ['packages/api/src/*.ts'],
    ignores: ['packages/api/src/local.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [DYNAMODB_LOCAL] }] },
  },
  {
    files: ['packages/api/src/shared-kernel/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            forbid(segment(...API_MODULES, 'platform'), 'The shared kernel depends on nothing else in the API.'),
            forbid(FRAMEWORKS, 'The shared kernel uses no framework, validation library or AWS SDK.'),
            COMPOSITION_ROOT,
            DYNAMODB_LOCAL,
          ],
        },
      ],
    },
  },
  {
    files: ['packages/api/src/platform/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            forbid(segment(...API_MODULES), 'Technical building blocks know nothing of the contexts.'),
            COMPOSITION_ROOT,
            DYNAMODB_LOCAL,
          ],
        },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Web (packages/web/src): Atomic Design. See docs/adr/0003-frontend-atomic-design.md.
//
// src/components has five levels, atoms <- molecules <- organisms <- templates
// <- pages, and a level uses only the levels below it. Only pages call the API,
// through the client src/api.ts builds; other code gets data through props
// (it may use the API's types). Atoms contain no fixed text. Links go through
// the LocalizedLink atom. Non-UI code (paths, the API client, brand constants,
// i18n) lives outside src/components.
// ---------------------------------------------------------------------------

const ATOMIC_LEVELS = ['atoms', 'molecules', 'organisms', 'templates', 'pages'];

// Calling the API. Only src/api.ts builds a client and knows the API's URLs;
// pages, and the test support's API mocks, use that client. Everywhere else the
// client and hono/client are off limits at runtime (their types are fine), and
// so is writing an /api URL by hand. Tests may write API URLs, to check the
// requests a page sends.
const API_CLIENT = 'packages/web/src/api.ts';
const TEST_SUPPORT = 'packages/web/src/test/**/*.{ts,tsx}';
const TESTS = 'packages/web/src/**/*.test.{ts,tsx}';
const ONLY_PAGES_CALL_THE_API = 'Only pages call the API, through the client in src/api.ts; other code gets data through props.';

const API_CLIENT_IMPORTS = {
  paths: [{ name: 'hono/client', allowTypeImports: true, message: ONLY_PAGES_CALL_THE_API }],
  patterns: [forbid('^(\\./|(\\.\\./)+)api$', ONLY_PAGES_CALL_THE_API, { allowTypeImports: true })],
};

const NO_API_URLS = 'Write no /api URLs by hand; call the API through the client in src/api.ts.';
const API_URL_SYNTAX = [
  { selector: 'Literal[value=/^\\/api(\\/|$)/]', message: NO_API_URLS },
  { selector: 'TemplateElement[value.raw=/^\\/api(\\/|$)/]', message: NO_API_URLS },
];

/**
 * The web's import restrictions: never the API's runtime code (only its
 * types), never the API client unless `callsApi`, plus `extra`.
 */
function webImportRestrictions({ callsApi = false, paths = [], patterns = [] } = {}) {
  const apiClient = callsApi ? { paths: [], patterns: [] } : API_CLIENT_IMPORTS;
  return [
    'error',
    {
      paths: [
        // The web app uses the API's route types (Hono RPC) but never its runtime code.
        { name: '@yi/api', allowTypeImports: true, message: 'Import only types from @yi/api (`import type`).' },
        ...apiClient.paths,
        ...paths,
      ],
      patterns: [
        { group: ['@yi/api/*', '**/api/src/**'], message: 'Import API types from @yi/api only.' },
        ...apiClient.patterns,
        ...patterns,
      ],
    },
  ];
}

const NO_FIXED_TEXT = 'Atoms contain no fixed text: take it from props.';

/** What a level may not import: the levels above it, and for atoms the translation resources. */
function atomicLevelPatterns(level) {
  const higher = ATOMIC_LEVELS.slice(ATOMIC_LEVELS.indexOf(level) + 1);
  const patterns = [];
  if (higher.length > 0) {
    patterns.push(forbid(segment(...higher), `Atomic Design: ${level} use only the levels below them.`));
  }
  if (level === 'atoms') {
    patterns.push(
      forbid(
        '(^|/)i18n/(useMessages|messages(/.*)?)$',
        'Atoms contain no fixed text, not even from the translation resources: take it from props.',
      ),
    );
  }
  return patterns;
}

/** Router links would drop the visitor's locale; the LocalizedLink atom keeps it. */
const ROUTER_LINKS = {
  name: 'react-router',
  importNames: ['Link', 'NavLink'],
  message: 'Use the LocalizedLink atom, so links keep the current locale.',
};

const LOCALIZED_LINK = 'packages/web/src/components/atoms/LocalizedLink.tsx';

const webApiConfigs = [
  {
    files: ['packages/web/src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': webImportRestrictions(),
      'no-restricted-syntax': ['error', ...API_URL_SYNTAX],
    },
  },
  {
    files: [API_CLIENT, TEST_SUPPORT],
    rules: { '@typescript-eslint/no-restricted-imports': webImportRestrictions({ callsApi: true }) },
  },
  {
    files: [API_CLIENT, TEST_SUPPORT, TESTS],
    rules: { 'no-restricted-syntax': 'off' },
  },
];

const atomicLevelConfigs = [
  ...ATOMIC_LEVELS.map((level) => ({
    files: [`packages/web/src/components/${level}/**/*.{ts,tsx}`],
    rules: {
      '@typescript-eslint/no-restricted-imports': webImportRestrictions({
        callsApi: level === 'pages',
        paths: [ROUTER_LINKS],
        patterns: atomicLevelPatterns(level),
      }),
    },
  })),
  {
    files: [LOCALIZED_LINK],
    rules: {
      '@typescript-eslint/no-restricted-imports': webImportRestrictions({ patterns: atomicLevelPatterns('atoms') }),
    },
  },
];

const TEXT_ATTRIBUTE = 'JSXAttribute[name.name=/^(alt|title|aria-label|placeholder)$/]';

/** Strings a JSX expression container shows: the expression itself, or a branch of a conditional or logical in it. */
const shownStrings = (container) => [
  `${container} > Literal[value=/\\S/]`,
  `${container} > TemplateLiteral > TemplateElement[value.raw=/\\S/]`,
  `${container} :matches(ConditionalExpression, LogicalExpression) > Literal[value=/\\S/]`,
  `${container} :matches(ConditionalExpression, LogicalExpression) > TemplateLiteral > TemplateElement[value.raw=/\\S/]`,
];

const ATOM_TEXT_SYNTAX = [
  'JSXText[value=/\\S/]',
  `${TEXT_ATTRIBUTE} > Literal`,
  ...shownStrings(':matches(JSXElement, JSXFragment) > JSXExpressionContainer'),
  ...shownStrings(`${TEXT_ATTRIBUTE} > JSXExpressionContainer`),
].map((selector) => ({ selector, message: NO_FIXED_TEXT }));

const atomTextConfig = {
  files: ['packages/web/src/components/atoms/**/*.tsx'],
  rules: { 'no-restricted-syntax': ['error', ...API_URL_SYNTAX, ...ATOM_TEXT_SYNTAX] },
};

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
  ...apiLayerConfigs,
  ...apiSharedConfigs,
  {
    files: ['packages/web/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite()],
    languageOptions: { globals: globals.browser },
  },
  ...webApiConfigs,
  ...atomicLevelConfigs,
  atomTextConfig,
]);
