import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/packages/cli',
  test: {
    name: 'cli',
    watch: false,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    reporters: ['default'],
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts'],
      reportsDirectory: '../../coverage/packages/cli',
      reporter: ['text-summary', 'lcov'],
      // Targets from docs/PRD.md "Testing".
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 90 },
    },
  },
});
