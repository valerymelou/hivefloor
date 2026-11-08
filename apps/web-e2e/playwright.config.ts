import { defineConfig, devices } from '@playwright/test';

const port = 4317;
const ci = process.env['CI'] !== undefined;

/**
 * End-to-end tests against demo mode (W7), served from the production build
 * with production headers (scripts/serve.mjs).
 */
export default defineConfig({
  testDir: './src',
  fullyParallel: true,
  // Software WebGL is heavy: more workers would starve the render loops.
  workers: 2,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  timeout: 60_000,
  reporter: ci ? [['github'], ['list']] : 'list',
  outputDir: '../../dist/web-e2e/results',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${String(port)}`,
    trace: 'retain-on-failure',
    // Software WebGL, so the 3D office renders on CI machines without a GPU.
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'node apps/web-e2e/scripts/serve.mjs',
    cwd: '../..',
    url: `http://localhost:${String(port)}`,
    reuseExistingServer: !ci,
    env: { PORT: String(port) },
  },
});
