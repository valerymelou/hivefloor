import axe from 'axe-core';

/**
 * Runs axe on a rendered element and returns the violations. Colour contrast
 * can't be computed in jsdom, so that rule is checked in the browser
 * (apps/web-e2e/src/accessibility.spec.ts).
 */
export async function axeViolations(element: Element): Promise<string[]> {
  const result = await axe.run(element, { rules: { 'color-contrast': { enabled: false } } });
  return result.violations.map((v) => `${v.id}: ${v.help}`);
}
