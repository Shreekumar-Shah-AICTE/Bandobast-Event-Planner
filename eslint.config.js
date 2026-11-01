// Lint rules are part of the quality bar: strict type-aware rules, small functions
// and files, no magic numbers outside constants, accessible JSX. Zero warnings allowed.
import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** One import rule per layer: `regex` matches the import paths this layer may not use. */
const boundary = (regex, why) => ({ patterns: [{ regex, message: `Layer boundary: ${why}.` }] });

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.app.json', './tsconfig.tools.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      complexity: ['error', 8],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'max-depth': ['error', 3],
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
      'max-params': ['error', 4],
      eqeqeq: 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-magic-numbers': 'off',
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          ignore: [0, 1, -1, 2, 100],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
          detectObjects: false,
        },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: false }],
    },
  },
  {
    // Layer boundaries (docs/ARCHITECTURE.md): the contracts and the planning engine stay pure,
    // the browser never imports server code, and the server never imports React or the UI.
    files: ['shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        boundary('^react|(^|/)(src|server|api)/', 'shared/ holds contracts only'),
      ],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        boundary('^react|(^|/)(ui|state|ai|server|api)/', 'the engine is pure TypeScript'),
      ],
    },
  },
  {
    files: ['src/state/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        boundary('(^|/)(ui|ai|server|api)/', 'state depends on the engine only'),
      ],
    },
  },
  {
    files: ['src/ai/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        boundary('^react|(^|/)(ui|state|server|api)/', 'AI readers stay UI-free'),
      ],
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        boundary('(^|/)(server|api)/', 'the browser never imports server code'),
      ],
    },
  },
  {
    files: ['server/**/*.ts', 'api/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        boundary('^react|(^|/)(ui|state|ai)/', 'the server never imports browser code'),
      ],
    },
  },
  {
    files: ['**/*.tsx'],
    ...jsxA11y.flatConfigs.strict,
    rules: {
      ...jsxA11y.flatConfigs.strict.rules,
      // WAI-ARIA tabs pattern: a tab panel takes focus when it starts with plain text.
      'jsx-a11y/no-noninteractive-tabindex': ['error', { tags: [], roles: ['tabpanel'] }],
    },
  },
  reactHooks.configs.flat['recommended-latest'],
  {
    // Data tables, named constants, tests and tool configs may use literal numbers and run long.
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      'e2e/**',
      'src/test/**',
      'src/domain/constants.ts',
      'src/domain/templates/**',
      'src/domain/catalog.ts',
      'src/domain/ideaLibrary.ts',
      'server/config.ts',
      '*.config.ts',
      '*.config.js',
    ],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'max-lines-per-function': 'off',
      'max-lines': 'off',
    },
  },
  { files: ['**/*.js'], ...tseslint.configs.disableTypeChecked },
);
