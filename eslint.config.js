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
// domain's (or application's) interfaces. Contexts use each other only through
// the other context's application layer. The composition root (app.ts,
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
    forbid(segment('interface'), 'Infrastructure implements interfaces from the domain or application layer.'),
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
        { patterns: [...rules, ...otherModuleRules(module, layer), COMPOSITION_ROOT] },
      ],
    },
  })),
);

const apiSharedConfigs = [
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
// <- pages, and a level uses only the levels below it. Only pages call the API;
// the other levels get data through props (they may use the API's types).
// Atoms contain no fixed text. Links go through the LocalizedLink atom. Non-UI
// code (paths, the API client, brand constants, i18n) lives outside
// src/components.
// ---------------------------------------------------------------------------

const ATOMIC_LEVELS = ['atoms', 'molecules', 'organisms', 'templates', 'pages'];

/** The web's import restrictions: always the API's type-only rule, plus `extra`. */
function webImportRestrictions(extra = {}) {
  return [
    'error',
    {
      paths: [
        // The web app uses the API's route types (Hono RPC) but never its runtime code.
        { name: '@yi/api', allowTypeImports: true, message: 'Import only types from @yi/api (`import type`).' },
        ...(extra.paths ?? []),
      ],
      patterns: [
        { group: ['@yi/api/*', '**/api/src/**'], message: 'Import API types from @yi/api only.' },
        ...(extra.patterns ?? []),
      ],
    },
  ];
}

/** What a level may not import: higher levels, and (below pages) the API client at runtime. */
function atomicLevelPatterns(level) {
  const index = ATOMIC_LEVELS.indexOf(level);
  const higher = ATOMIC_LEVELS.slice(index + 1);
  const patterns = [];
  if (higher.length > 0) {
    patterns.push(forbid(segment(...higher), `Atomic Design: ${level} use only the levels below them.`));
  }
  if (level !== 'pages') {
    patterns.push(
      forbid('^(\\.\\./)+api$', 'Only pages call the API; the other levels get data through props.', {
        allowTypeImports: true,
      }),
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

const atomicLevelConfigs = [
  ...ATOMIC_LEVELS.map((level) => ({
    files: [`packages/web/src/components/${level}/**/*.{ts,tsx}`],
    rules: {
      '@typescript-eslint/no-restricted-imports': webImportRestrictions({
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

const NO_FIXED_TEXT = 'Atoms contain no fixed text: take it from props.';

const atomTextConfig = {
  files: ['packages/web/src/components/atoms/**/*.tsx'],
  rules: {
    'no-restricted-syntax': [
      'error',
      { selector: 'JSXText[value=/\\S/]', message: NO_FIXED_TEXT },
      { selector: 'JSXAttribute[name.name=/^(alt|title|aria-label|placeholder)$/] > Literal', message: NO_FIXED_TEXT },
    ],
  },
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
    rules: { '@typescript-eslint/no-restricted-imports': webImportRestrictions() },
  },
  ...atomicLevelConfigs,
  atomTextConfig,
]);
