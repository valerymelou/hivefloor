import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/packages/cli',
  resolve: { tsconfigPaths: true },
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
      // bin.ts only wires process globals into main(); it is exercised by the integration test.
      exclude: ['src/**/*.{test,spec}.ts', 'src/bin.ts', 'src/test/**'],
      reportsDirectory: '../../coverage/packages/cli',
      reporter: ['text-summary', 'lcov'],
      // Targets from docs/PRD.md "Testing".
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 90 },
    },
  },
});
