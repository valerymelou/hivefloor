import { describe, expect, it } from 'vitest';
import { DEBOUNCE_SEC, shouldSend } from './debounce.js';

const last = { kind: 'tool', cat: 'coding', at: 100 } as const;

describe('shouldSend (C8)', () => {
  it('sends the first event', () => {
    expect(shouldSend(undefined, { kind: 'tool', cat: 'coding' }, 100)).toBe(true);
  });

  it('skips a repeat within the window and sends it after', () => {
    expect(shouldSend(last, { kind: 'tool', cat: 'coding' }, 100 + DEBOUNCE_SEC - 1)).toBe(false);
    expect(shouldSend(last, { kind: 'tool', cat: 'coding' }, 100 + DEBOUNCE_SEC)).toBe(true);
  });

  it('sends a change at once', () => {
    expect(shouldSend(last, { kind: 'tool', cat: 'testing' }, 101)).toBe(true);
    expect(shouldSend(last, { kind: 'thinking' }, 101)).toBe(true);
    expect(shouldSend(last, { kind: 'tool', cat: 'coding', goal: 'New goal' }, 101)).toBe(true);
  });

  it.each(['start', 'end', 'spawn', 'done', 'idle'] as const)('always sends %s', (kind) => {
    expect(shouldSend({ kind, at: 100 }, { kind }, 100)).toBe(true);
  });
});
