import nx from '@nx/eslint-plugin';
import jsdoc from 'eslint-plugin-jsdoc';
import tseslint from 'typescript-eslint';

const tsFiles = ['**/*.ts', '**/*.mts', '**/*.cts'];
const testFiles = ['**/*.spec.ts', '**/*.test.ts', '**/test/**/*.ts'];

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/coverage',
      '**/.nx',
      '**/.wrangler',
      '**/vitest.config.*.timestamp*',
    ],
  },

  // Module boundaries (CLAUDE.md, PRD "Repository layout"): every app and the
  // CLI may depend only on the shared schema package, never on each other.
  {
    files: ['**/*.ts', '**/*.mts', '**/*.cts', '**/*.js', '**/*.mjs', '**/*.cjs'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            { sourceTag: 'type:shared', onlyDependOnLibsWithTags: ['type:shared'] },
            { sourceTag: 'scope:cli', onlyDependOnLibsWithTags: ['type:shared'] },
            { sourceTag: 'scope:relay', onlyDependOnLibsWithTags: ['type:shared'] },
            { sourceTag: 'scope:web', onlyDependOnLibsWithTags: ['type:shared'] },
            { sourceTag: 'scope:site', onlyDependOnLibsWithTags: ['type:shared'] },
            { sourceTag: 'type:e2e', onlyDependOnLibsWithTags: ['type:shared'] },
          ],
        },
      ],
    },
  },

  // Strict, type-aware TypeScript rules.
  ...[...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked].map(
    (config) => ({ ...config, files: tsFiles }),
  ),
  {
    files: tsFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { requireDefaultForNonUnion: true, considerDefaultExhaustiveForUnions: false },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // `{ unwanted: _x, ...rest }` is the standard way to drop a field without mutation.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Every exported symbol carries TSDoc (CLAUDE.md).
  {
    files: tsFiles,
    ignores: [...testFiles, '**/vitest.config.*', '**/vite.config.*'],
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: {
            ArrowFunctionExpression: true,
            ClassDeclaration: true,
            FunctionDeclaration: true,
            FunctionExpression: true,
            MethodDefinition: true,
          },
          contexts: [
            'TSInterfaceDeclaration',
            'TSTypeAliasDeclaration',
            'TSEnumDeclaration',
            'ExportNamedDeclaration > VariableDeclaration',
          ],
        },
      ],
    },
  },

  // Tests and test helpers may use non-null assertions and inferred return types.
  {
    files: testFiles,
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
];
