import type { Page } from '@playwright/test';
import { expect, RELAY_CONFIG, relaySnapshot, test } from '../src/support';

/** Stands in for the relay, under the base path the office is served from. */
async function mockOfficeRelay(page: Page): Promise<void> {
  await page.route('**/office/api/config', (route) => route.fulfill({ json: RELAY_CONFIG }));
  await page.routeWebSocket(/\/office\/live$/, (socket) => {
    socket.send(JSON.stringify(relaySnapshot()));
  });
}

test.describe('the site', () => {
  test('the landing page embeds the live office', async ({ page }) => {
    await mockOfficeRelay(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Claude Code');
    const office = page.frameLocator('iframe');
    await expect(office.locator('hf-live-badge a')).toContainText('1 agent working', {
      timeout: 20_000,
    });
    await expect(office.locator('hf-activity-feed')).toHaveCount(0);
    await expect(page.getByText('not affiliated with or endorsed by Anthropic')).toBeVisible();
  });

  test('its policy allows only the inline scripts it ships', async ({ page }) => {
    await mockOfficeRelay(page);
    const response = await page.goto('/');
    const csp = response?.headers()['content-security-policy'] ?? '';
    expect(csp).toMatch(/script-src 'self'( 'sha256-[^']+')+;/);
    expect(csp).not.toMatch(/unsafe-inline'[^;]*;\s*connect|script-src[^;]*unsafe/);
    expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('the guides are pre-rendered from docs/ and link to each other', async ({ page }) => {
    await page.goto('/docs');
    await page.getByRole('link', { name: 'Self-hosting' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Self-hosting');
    const html = await (await page.request.get('/docs/privacy')).text();
    expect(html).toContain('What leaves your machine');
    expect(html).toContain('href="/docs/self-hosting#protect-ingest-from-floods"');
  });

  test('the office works under /office with its own strict policy', async ({ page }) => {
    const response = await page.goto('/office/#demo');
    const csp = response?.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("script-src 'self';");
    await expect(page.locator('hf-office-canvas')).toHaveAttribute('data-state', 'ready', {
      timeout: 20_000,
    });
    await expect(page.locator('.hf-tag').first()).toBeAttached();
  });
});
