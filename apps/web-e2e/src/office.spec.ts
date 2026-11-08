import { DEMO, expect, openDemo, tag, test } from './support';

test.describe('the 3D office in demo mode (W1–W4, W7)', () => {
  test('draws the building with the starting robots at their desks', async ({ page }) => {
    await openDemo(page);
    await expect(page.locator('.hf-room-label', { hasText: 'Ledgerly' })).toBeVisible();
    await expect(page.locator('.hf-room-label', { hasText: 'Private projects' })).toBeVisible();
    await expect(page.locator('.hf-room-label', { hasText: 'Coffee corner' })).toBeVisible();
    const seated = tag(page, DEMO.seated);
    await expect(seated).toHaveAttribute('data-pose', 'sit');
    await expect(seated).toHaveAttribute('data-motion', 'resting');
    await expect(seated.locator('.hf-name')).toHaveText('Claude · Ledgerly');
  });

  test('a robot arrives and sits at its desk', async ({ page }) => {
    test.setTimeout(120_000);
    await openDemo(page);
    const newcomer = tag(page, DEMO.newcomer);
    await expect(newcomer).toHaveAttribute('data-motion', 'arriving', { timeout: 50_000 });
    await expect(newcomer.locator('.hf-badge')).toHaveText('Arriving');
    await expect(page.locator('.hf-room-label', { hasText: 'Builderswave' })).toBeVisible();
    await expect(newcomer).toHaveAttribute('data-motion', 'resting', { timeout: 40_000 });
    await expect(newcomer).toHaveAttribute('data-pose', 'sit');
  });

  test('a session ends and its robot walks out', async ({ page }) => {
    await openDemo(page);
    const visitor = tag(page, DEMO.visitor);
    await expect(visitor).toHaveAttribute('data-motion', 'leaving', { timeout: 40_000 });
    await expect(visitor.locator('.hf-badge')).toHaveText('Leaving');
    await expect(visitor).toHaveCount(0, { timeout: 30_000 });
  });

  test('a subagent comes, sits at the team table and goes', async ({ page }) => {
    test.setTimeout(90_000);
    await openDemo(page);
    const subagent = tag(page, DEMO.subagent);
    await expect(subagent).toHaveAttribute('data-pose', 'sit', { timeout: 20_000 });
    await expect(subagent).toHaveAttribute('data-motion', 'resting', { timeout: 25_000 });
    await expect(subagent.locator('.hf-name')).toHaveText('code-reviewer · subagent');
    await expect(subagent).toHaveAttribute('data-motion', 'leaving', { timeout: 40_000 });
    await expect(subagent.locator('.hf-badge')).toHaveText('Done, heading out');
    await expect(subagent).toHaveCount(0, { timeout: 30_000 });
  });

  test('a robot takes a coffee break', async ({ page }) => {
    test.setTimeout(120_000);
    await openDemo(page);
    const robot = tag(page, DEMO.coffee);
    await expect(robot).toHaveAttribute('data-status', 'idle', { timeout: 80_000 });
    await expect(robot).toHaveAttribute('data-pose', 'coffee');
    await expect(robot).toHaveAttribute('data-motion', 'resting', { timeout: 30_000 });
    await expect(robot.locator('.hf-badge')).toHaveText('On a break');
    await expect(page.locator('.hf-room-label', { hasText: 'Coffee corner' })).toContainText(
      '1 on a break',
    );
  });
});

test.describe('interaction (W8, W9, W11)', () => {
  test('clicking a robot opens its card, and Escape closes it', async ({ page }) => {
    await openDemo(page);
    const anchor = tag(page, DEMO.seated).locator('..');
    const box = await anchor.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const card = page.getByTestId('robot-card');
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading')).toHaveText('Claude · Ledgerly');
    await expect(card).toContainText('Status');
    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
  });

  test('the arrow keys orbit the camera', async ({ page }) => {
    await openDemo(page);
    const anchor = tag(page, DEMO.seated).locator('..');
    await page.locator('hf-office-canvas canvas').focus();
    const before = await anchor.evaluate((el) => el.style.transform);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect
      .poll(() => anchor.evaluate((el) => el.style.transform), { timeout: 20_000 })
      .not.toBe(before);
  });

  test('the list view is one click away', async ({ page }) => {
    await openDemo(page);
    const toggle = page.getByRole('button', { name: 'List view' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('table', { name: /Every agent in the office/ })).toBeVisible();
    await expect(page.locator('hf-office-canvas')).toHaveCount(0);
    await toggle.click();
    await expect(page.locator('hf-office-canvas')).toHaveAttribute('data-state', 'ready');
  });
});

test.describe('fallbacks and modes (W10, W11, W12)', () => {
  test('shows the list view when WebGL is unavailable', async ({ page }) => {
    await page.addInitScript(() => {
      const canvas = HTMLCanvasElement.prototype as unknown as {
        getContext: (this: HTMLCanvasElement, type: string) => unknown;
      };
      const original = canvas.getContext;
      canvas.getContext = function (type) {
        return type.startsWith('webgl') ? null : original.call(this, type);
      };
    });
    await page.goto('/#demo');
    await expect(page.getByRole('table', { name: /Every agent in the office/ })).toBeVisible();
    await expect(page.getByText('This browser cannot draw the 3D office')).toBeVisible();
    await expect(page.getByRole('button', { name: 'List view' })).toBeDisabled();
  });

  test('with reduced motion, robots appear in place instead of walking', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openDemo(page);
    const visitor = tag(page, DEMO.visitor);
    await expect(visitor).toHaveCount(1, { timeout: 20_000 });
    await expect(visitor).toHaveAttribute('data-motion', 'resting');
    await expect(visitor).toHaveAttribute('data-pose', 'sit');
  });

  test('phones get the collapsed feed and the office above the panels', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await openDemo(page);
    await expect(page.getByRole('button', { name: 'Show more' })).toBeVisible({ timeout: 20_000 });
    const canvas = await page.locator('hf-office-canvas').boundingBox();
    const feed = await page.locator('hf-activity-feed').boundingBox();
    expect(canvas !== null && feed !== null && canvas.y < feed.y).toBe(true);
    await context.close();
  });
});

test.describe('a big office from the relay (E4, E8)', () => {
  const COLOR = '#6ea8fe';
  const ROOMS = 14;
  const ROBOTS = 50;
  const CONFIG = {
    v: 1,
    title: 'Big office',
    owner: 'Test',
    timezone: 'UTC',
    publicProjects: [],
    privateRoom: { name: 'Private projects', color: '#8d94ab', visible: true },
    agentTypes: ['Explore'],
    presence: { idleAfterSec: 180, awayAfterSec: 900, leaveAfterSec: 3600 },
    viewerCap: 500,
  };
  const rooms = Array.from({ length: ROOMS }, (_, slot) => ({
    id: `project-${String(slot)}`,
    name: `Project ${String(slot)}`,
    color: COLOR,
    slot,
    floor: Math.floor(slot / 8),
    rows: 2,
    lit: true,
  }));
  // Later rooms are the quietest, so the layout folds them into "Other projects".
  const robots = Array.from({ length: ROBOTS }, (_, i) => {
    const room = i % ROOMS;
    return {
      key: (0xa00000 + i).toString(16),
      role: 'claude',
      room: `project-${String(room)}`,
      desk: Math.floor(i / ROOMS),
      status: 'working',
      cat: 'coding',
      since: 2000 - room * 10 - i,
    };
  });

  test('stacks a second floor, folds quiet rooms and shows "+N" signs', async ({ page }) => {
    await page.route('**/api/config', (route) => route.fulfill({ json: CONFIG }));
    await page.routeWebSocket(/\/live$/, (socket) => {
      socket.send(JSON.stringify({ type: 'snapshot', v: 1, at: 2000, rooms, robots, today: [] }));
    });
    await page.goto('/');
    await expect(page.locator('hf-office-canvas')).toHaveAttribute('data-state', 'ready', {
      timeout: 20_000,
    });
    await expect(page.locator('.hf-room-label', { hasText: 'Other projects' })).toHaveCount(1);
    // Project 8 starts the second floor (E4); three rooms fold away (E8).
    await expect(page.locator('.hf-room-label', { hasText: 'Project 8' })).toHaveCount(1);
    await expect(page.locator('.hf-room-label', { hasText: 'Project 13' })).toHaveCount(0);
    await expect(page.locator('.hf-tag')).toHaveCount(40);
    const signs = await page.locator('.hf-more').allTextContents();
    const hidden = signs.reduce((sum, sign) => sum + Number(sign.replace('+', '')), 0);
    expect(hidden).toBe(ROBOTS - 40);
    // The list view always shows everyone (E8).
    await page.getByRole('button', { name: 'List view' }).click();
    await expect(page.locator('hf-robot-list tbody tr')).toHaveCount(ROBOTS);
  });
});
