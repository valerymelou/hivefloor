import { describe, expect, it } from 'vitest';
import { configReference } from './config-reference.js';

// CI fails on drift; run `pnpm nx run schema:json-schema` to regenerate.
describe('docs/configuration-reference.md', () => {
  it('is up to date', async () => {
    await expect(configReference()).toMatchFileSnapshot('../../../docs/configuration-reference.md');
  });

  it('covers nested fields, required fields and defaults', () => {
    const page = configReference();
    expect(page).toContain('| `owner` | text | required |');
    expect(page).toContain('| `layout.desksPerRow` | number, 1 to 6 | `3` |');
    expect(page).toContain('| `publicProjects[].name` |');
    expect(page).toContain('| `projects[].path` |');
    expect(page).not.toContain('$schema`');
  });

  it('describes every field', () => {
    for (const line of configReference().split('\n')) {
      if (!line.startsWith('| `')) continue;
      expect(line.split('|')[4]?.trim(), line).not.toBe('');
    }
  });
});
