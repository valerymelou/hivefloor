import { expect, test as base, type Locator, type Page } from '@playwright/test';

/**
 * Robots from the demo simulator's fixed seed (apps/web/src/app/demo). Steps
 * come every 1.5 s, so these events happen at the same time on every run.
 */
export const DEMO = {
  /** At a desk from the start, in Ledgerly. */
  seated: '67d044',
  /** Arrives in Ledgerly at step 7 and leaves at step 18. */
  visitor: '9f22cd',
  /** Arrives at step 22, opening the Builderswave room, and stays. */
  newcomer: 'b969dc',
  /** A subagent that arrives at step 6 and leaves with its session at step 26. */
  subagent: '0fdc7f:8c4344',
  /** Goes for coffee at step 43. */
  coffee: '420033',
} as const;

/** A robot's floating tag. */
export function tag(page: Page, key: string): Locator {
  return page.locator(`.hf-tag[data-robot="${key}"]`);
}

/** Opens demo mode (`#demo` or `#demo-crowd`) and waits for the 3D office to be drawn. */
export async function openDemo(page: Page, hash = '#demo'): Promise<void> {
  await page.goto(`/${hash}`);
  await expect(page.locator('hf-office-canvas')).toHaveAttribute('data-state', 'ready', {
    timeout: 20_000,
  });
}

/**
 * The test runner with a check that the page logs no errors, which includes
 * Content-Security-Policy violations, since the server sends the production
 * headers.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await use(errors);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
