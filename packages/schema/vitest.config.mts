import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/packages/schema',
  test: {
    name: 'schema',
    watch: false,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    reporters: ['default'],
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts'],
      reportsDirectory: '../../coverage/packages/schema',
      reporter: ['text-summary', 'lcov'],
      // Targets from docs/PRD.md "Testing".
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 95 },
    },
  },
});
