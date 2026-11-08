import * as jsonParser from 'jsonc-eslint-parser';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  { ignores: ['worker-configuration.d.ts', '.wrangler/**'] },
  {
    files: ['src/**/*.ts'],
    rules: {
      // Worker logs must never include request bodies or headers (docs/privacy.md).
      'no-console': 'error',
    },
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/vitest.config.{js,ts,mjs,mts}',
          ],
          // Bundled into the Worker by Wrangler from the workspace.
          ignoredDependencies: ['@hivefloor/schema', 'zod'],
        },
      ],
    },
    languageOptions: { parser: jsonParser },
  },
];
