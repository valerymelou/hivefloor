import { defineConfig, devices } from '@playwright/test';

const port = 4318;
const ci = process.env['CI'] !== undefined;

/** The landing page, docs and office, assembled as they are deployed. */
export default defineConfig({
  testDir: './site',
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  timeout: 60_000,
  reporter: ci ? [['github'], ['list']] : 'list',
  outputDir: '../../dist/web-e2e/site-results',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${String(port)}`,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'node apps/web-e2e/scripts/serve.mjs',
    cwd: '../..',
    url: `http://localhost:${String(port)}`,
    reuseExistingServer: !ci,
    env: { PORT: String(port), SERVE_DIR: 'site-deploy' },
  },
});
