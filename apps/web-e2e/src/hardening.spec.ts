import { test as base, type Page } from '@playwright/test';
import { DEMO, expect, openDemo, RELAY_CONFIG, relaySnapshot, tag, test } from './support';

const status = (page: Page) => page.getByRole('status');

/** Answers the config request; `socket` runs for each WebSocket connection. */
async function mockRelay(
  page: Page,
  socket: (send: (message: object) => void, close: () => void, connection: number) => void,
): Promise<void> {
  await page.route('**/api/config', (route) => route.fulfill({ json: RELAY_CONFIG }));
  let connection = 0;
  await page.routeWebSocket(/\/live$/, (ws) => {
    connection++;
    socket(
      (message) => {
        ws.send(JSON.stringify(message));
      },
      () => void ws.close(),
      connection,
    );
  });
}

test.describe('security headers (threat model)', () => {
  test('every page and asset carries them', async ({ page, request }) => {
    const response = await page.goto('/#demo');
    expect(response).not.toBeNull();
    const headers = response?.headers() ?? {};
    const csp = headers['content-security-policy'] ?? '';
    for (const directive of [
      "default-src 'self'",
      "script-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "form-action 'none'",
    ]) {
      expect(csp).toContain(directive);
    }
    expect(csp).not.toMatch(/script-src[^;]*(unsafe-inline|unsafe-eval|wasm-unsafe-eval)/);
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
    const model = await request.get('/models/robot-expressive.glb');
    expect(model.headers()['x-content-type-options']).toBe('nosniff');
    expect(model.headers()['content-security-policy']).toBe(csp);
  });
});

// These break the policy on purpose, so the browser logs errors.
base.describe('the Content Security Policy is enforced', () => {
  base('blocks inline scripts, eval and other origins', async ({ page }) => {
    await page.goto('/#demo');
    const result = await page.evaluate(async () => {
      const violation = new Promise<string>((resolve) => {
        document.addEventListener(
          'securitypolicyviolation',
          (event) => {
            resolve(event.effectiveDirective);
          },
          { once: true },
        );
      });
      const script = document.createElement('script');
      script.textContent = 'window.injected = true';
      document.head.append(script);
      const directive = await violation;
      let evaluated = true;
      try {
        (0, eval)('1');
      } catch {
        evaluated = false;
      }
      const fetched = await fetch('https://example.com/').then(
        () => true,
        () => false,
      );
      return {
        directive,
        evaluated,
        fetched,
        injected: 'injected' in window,
      };
    });
    expect(result).toEqual({
      directive: 'script-src-elem',
      evaluated: false,
      fetched: false,
      injected: false,
    });
  });
});

test.describe('script injection through goal text (threat model)', () => {
  const PAYLOAD = '<img src=x onerror=window.pwned=1>';

  test('a goal is shown as text in the tag, the panel and the list', async ({ page }) => {
    await mockRelay(page, (send) => {
      send(relaySnapshot(PAYLOAD));
    });
    await page.goto('/');
    await expect(page.locator('hf-office-canvas')).toHaveAttribute('data-state', 'ready', {
      timeout: 20_000,
    });
    await expect(tag(page, 'a9f3c2').locator('.hf-goal')).toHaveText(PAYLOAD);
    await expect(page.locator('hf-public-work')).toContainText(PAYLOAD);
    await page.getByRole('button', { name: 'List view' }).click();
    await expect(page.locator('hf-robot-list')).toContainText(PAYLOAD);
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(await page.evaluate(() => 'pwned' in window)).toBe(false);
  });
});

test.describe('connection states (W6, H11, H12)', () => {
  test('shows Reconnecting after a drop, then Live again', async ({ page }) => {
    await page.route('**/api/snapshot', (route) => route.fulfill({ json: relaySnapshot() }));
    await mockRelay(page, (send, close, connection) => {
      send(relaySnapshot());
      if (connection === 1) setTimeout(close, 1000);
    });
    await page.goto('/');
    await expect(status(page)).toHaveText('Live');
    await expect(status(page)).toHaveText('Reconnecting…', { timeout: 5000 });
    await expect(status(page)).toHaveText('Live', { timeout: 10_000 });
  });

  // The browser logs the 429, which is the point of the test.
  base('shows Office closed when the daily limit is reached', async ({ page }) => {
    await page.route('**/api/snapshot', (route) =>
      route.fulfill({ status: 429, body: 'error code: 1027' }),
    );
    await mockRelay(page, (send, close) => {
      send(relaySnapshot());
      setTimeout(close, 500);
    });
    await page.goto('/');
    // The next 00:00 UTC, in the office's time zone (UTC+1).
    await expect(status(page)).toHaveText('Office closed until 01:00', { timeout: 5000 });
  });

  test('shows Busy above the viewer cap and polls instead of reconnecting', async ({ page }) => {
    let connections = 0;
    await page.route('**/api/snapshot', (route) => route.fulfill({ json: relaySnapshot() }));
    await mockRelay(page, (send, close) => {
      connections++;
      send({ type: 'status', v: 1, state: 'busy' });
      close();
    });
    await page.goto('/');
    await expect(status(page)).toHaveText('Busy: updates every few minutes');
    await expect(page.locator('hf-public-work')).toContainText('Building the paywall screen');
    await page.waitForTimeout(3000);
    expect(connections).toBe(1);
  });

  test('demo mode never touches the network for office data', async ({ page }) => {
    const calls: string[] = [];
    page.on('request', (request) => {
      if (/\/(api|live|ingest)/.test(request.url())) calls.push(request.url());
    });
    await openDemo(page);
    await expect(tag(page, DEMO.seated)).toHaveCount(1);
    expect(calls).toEqual([]);
  });
});
