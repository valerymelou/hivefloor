import { describe, expect, it } from 'vitest';
import { configJsonSchema } from './json-schema.js';

// The committed office.schema.json and machine.schema.json must match the Zod
// source. CI fails on drift; run `pnpm nx run schema:json-schema` to regenerate.
describe('generated JSON Schema', () => {
  it.each(['office', 'machine'] as const)('%s.schema.json is up to date', async (which) => {
    const json = `${JSON.stringify(configJsonSchema(which), null, 2)}\n`;
    await expect(json).toMatchFileSnapshot(`../${which}.schema.json`);
  });

  it('describes the hand-written file, with defaults optional', () => {
    const office = configJsonSchema('office');
    expect(office['required']).toEqual(['v', 'owner', 'timezone']);
    expect(office['additionalProperties']).toBe(false);
  });
});
