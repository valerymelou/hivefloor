import * as jsonParser from 'jsonc-eslint-parser';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      // The hook must never print: Claude Code adds hook stdout to Claude's context (C2).
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
            '{projectRoot}/tsdown.config.{js,ts,mjs,mts}',
            '{projectRoot}/scripts/**',
          ],
          // Bundled into bin.mjs by tsdown: the published package has zero runtime dependencies.
          ignoredDependencies: ['@hivefloor/schema', 'zod'],
        },
      ],
    },
    languageOptions: {
      parser: jsonParser,
    },
  },
];
