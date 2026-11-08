import { createRequire } from 'node:module';
import type { AxeResults } from 'axe-core';
import { expect, openDemo, test } from './support';

const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

test.describe('accessibility', () => {
  // axe is injected as a script, which the production CSP would block.
  test.use({ bypassCSP: true });

  for (const view of ['3d', 'list'] as const) {
    test(`axe finds no violations in the ${view} view, colour contrast included`, async ({
      page,
    }) => {
      await openDemo(page);
      if (view === 'list') await page.getByRole('button', { name: 'List view' }).click();
      await page.addScriptTag({ path: axePath });
      const results = await page.evaluate(async () => {
        const axe = (
          window as unknown as { axe: { run: (context: unknown) => Promise<AxeResults> } }
        ).axe;
        // Floating tags are decorative (aria-hidden); the list view carries the same content.
        return axe.run({ exclude: [['.hf-labels']] });
      });
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
        ),
      ).toEqual([]);
    });
  }
});
