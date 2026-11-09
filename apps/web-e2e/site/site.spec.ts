import type { Page, WebSocketRoute } from '@playwright/test';
import { expect, RELAY_CONFIG, relaySnapshot, test } from '../src/support';

/** Stands in for the relay, under the base path the office is served from. */
async function mockOfficeRelay(page: Page): Promise<void> {
  await page.route('**/office/api/config', (route) => route.fulfill({ json: RELAY_CONFIG }));
  await page.routeWebSocket(/\/office\/live$/, (socket) => {
    socket.send(JSON.stringify(relaySnapshot()));
  });
}

/** The value of one tag in pre-rendered HTML, so nothing here relies on scripts running. */
function attribute(html: string, tag: string, name: string): string | undefined {
  for (const [element] of html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))) {
    if (element.includes(name)) return /(?:content|href)="([^"]*)"/.exec(element)?.[1];
  }
  return undefined;
}

test.describe('search and link previews', () => {
  const SITE = 'https://hivefloor.valerymelou.com';
  const pages = [
    {
      path: '/',
      title: 'Hivefloor: a live 3D office for your Claude Code sessions',
      type: 'website',
    },
    { path: '/docs/', title: 'Documentation | Hivefloor', type: 'article' },
    { path: '/docs/hooks/', title: 'Claude Code hooks | Hivefloor docs', type: 'article' },
  ];

  for (const { path, title, type } of pages) {
    test(`${path} is described in its pre-rendered HTML`, async ({ request }) => {
      const html = await (await request.get(path)).text();
      expect(/<title[^>]*>([^<]*)</.exec(html)?.[1]).toBe(title);
      expect(attribute(html, 'link', 'rel="canonical"')).toBe(`${SITE}${path}`);
      expect(attribute(html, 'meta', 'property="og:url"')).toBe(`${SITE}${path}`);
      expect(attribute(html, 'meta', 'property="og:type"')).toBe(type);
      expect(attribute(html, 'meta', 'property="og:title"')).toBe(title);
      expect(attribute(html, 'meta', 'name="description"')?.length).toBeGreaterThan(50);
      expect(attribute(html, 'meta', 'property="og:image"')).toBe(`${SITE}/assets/og-image.jpg`);
      expect(attribute(html, 'meta', 'name="twitter:card"')).toBe('summary_large_image');
      expect(attribute(html, 'meta', 'name="twitter:creator"')).toBe('@valerymelou');
      const data = /<script[^>]*ld\+json[^>]*>([^<]*)</.exec(html)?.[1] ?? '';
      expect(data).toContain('Valery Melou');
      expect(() => JSON.parse(data) as unknown).not.toThrow();
    });
  }

  test('the tags follow the page when moving around in the browser', async ({ page }) => {
    await mockOfficeRelay(page);
    await page.goto('/');
    await page.getByRole('link', { name: 'Docs', exact: true }).click();
    await expect(page).toHaveTitle('Documentation | Hivefloor');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE}/docs/`);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  });

  test('the images, icons, robots file and sitemap are served', async ({ request }) => {
    for (const file of [
      '/assets/og-image.jpg',
      '/favicon.ico',
      '/favicon.svg',
      '/assets/icons/apple-touch-icon.png',
      '/assets/site.webmanifest',
      '/robots.txt',
    ]) {
      expect((await request.get(file)).status(), file).toBe(200);
    }
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain(`<loc>${SITE}/</loc>`);
    expect(sitemap).toContain(`<loc>${SITE}/docs/self-hosting/</loc>`);
    expect(sitemap).not.toContain('/office');
  });
});

test.describe('the site', () => {
  test('the landing page is the office, with its name, links and credits', async ({ page }) => {
    await mockOfficeRelay(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hivefloor');
    const office = page.frameLocator('iframe');
    await expect(office.locator('hf-live-badge a')).toContainText('1 agent working', {
      timeout: 20_000,
    });
    await expect(office.locator('hf-activity-feed')).toBeVisible();
    await expect(office.locator('hf-public-work')).toContainText('Building the paywall screen');
    await expect(office.locator('hf-office-header')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Docs' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'GitHub' })).toBeVisible();
    await expect(page.getByText('Not affiliated with or endorsed by Anthropic')).toBeVisible();
  });

  test('simulated robots fill an empty office, labelled, until a real one arrives', async ({
    page,
  }) => {
    const real = relaySnapshot() as { robots: object[] };
    await page.route('**/office/api/config', (route) => route.fulfill({ json: RELAY_CONFIG }));
    let relay: WebSocketRoute | undefined;
    await page.routeWebSocket(/\/office\/live$/, (socket) => {
      relay = socket;
      socket.send(JSON.stringify({ ...real, robots: [], rooms: [], today: [] }));
    });
    await page.goto('/');
    const badge = page.frameLocator('iframe').locator('hf-live-badge a');
    await expect(badge).toContainText('Demo: simulated robots', { timeout: 20_000 });
    relay?.send(JSON.stringify(real));
    await expect(badge).toContainText('1 agent working', { timeout: 20_000 });
    await expect(page.frameLocator('iframe').locator('hf-public-work')).toContainText(
      'Building the paywall screen',
    );
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
    await page.getByRole('link', { name: 'Self-hosting' }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Self-hosting');
    // The guide sits in the docs layout, styled: a bare Markdown route would not be.
    const heading = page.locator('.hf-prose h2').first();
    await expect(heading).toContainText('Deploy your office');
    await expect(heading).toHaveCSS('font-size', '26px');
    await expect(page.locator('.hf-prose pre').first()).toHaveCSS(
      'background-color',
      'rgb(12, 13, 30)',
    );
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
