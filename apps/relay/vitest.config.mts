import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const exampleOffice = JSON.parse(
  readFileSync(new URL('../../office.config.example.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

// Tests run inside the real Workers runtime (workerd) with the relay's own
// Wrangler config: the Worker, the Office Durable Object and its SQLite storage.
export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/relay',
  resolve: { tsconfigPaths: true },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          HIVEFLOOR_SECRET: 'test-secret-0123456789abcdef',
          // The example office with a viewer cap of 2, so tests can reach it.
          OFFICE_CONFIG: JSON.stringify({ ...exampleOffice, viewerCap: 2 }),
        },
      },
    }),
  ],
  test: {
    name: 'relay',
    watch: false,
    include: ['{src,test}/**/*.{test,spec}.ts'],
    reporters: ['default'],
    coverage: {
      enabled: true,
      // V8 coverage isn't available in workerd; Istanbul instruments instead.
      provider: 'istanbul',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts'],
      reportsDirectory: '../../coverage/apps/relay',
      reporter: ['text-summary', 'lcov'],
      // Target from docs/PRD.md "Testing".
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 85 },
    },
  },
});
