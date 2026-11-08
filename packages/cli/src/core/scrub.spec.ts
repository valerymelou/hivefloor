import { describe, expect, it } from 'vitest';
import { payloads, PRIVATE_STRINGS } from '../test/payloads.js';
import { scrubPayload } from './scrub.js';

describe('scrubPayload (--record)', () => {
  it('keeps the shape and enum fields but no private values', () => {
    const scrubbed = scrubPayload(payloads.bash('git push https://token@github.com/acme/x'));
    expect(scrubbed).toMatchObject({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      permission_mode: 'default',
      effort: { level: 'high' },
      tool_input: { command: '<string:40>' },
      cwd: '<string:36>',
    });
    const text = JSON.stringify(scrubbed);
    for (const secret of PRIVATE_STRINGS) expect(text).not.toContain(secret);
  });

  it('hides MCP names, odd keys and deep or long data', () => {
    expect(scrubPayload({ tool_name: 'mcp__acme__fetch' })).toEqual({
      tool_name: 'mcp__<server>__<tool>',
    });
    expect(scrubPayload({ 'acme bank': 1 })).toEqual({ '<key:0>': 1 });
    expect(scrubPayload({ status: 'not an enum!' })).toEqual({ status: '<string:12>' });
    expect(scrubPayload({ a: { b: { c: { d: { e: { f: { g: 1 } } } } } } })).toEqual({
      a: { b: { c: { d: { e: { f: '<nested>' } } } } },
    });
    expect(scrubPayload({ list: Array.from({ length: 30 }, (_, i) => i) })).toEqual({
      list: Array.from({ length: 20 }, (_, i) => i),
    });
    expect(scrubPayload({ x: null, y: true, z: undefined })).toEqual({ x: null, y: true, z: null });
  });
});
