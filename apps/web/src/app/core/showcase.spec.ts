import { describe, expect, it } from 'vitest';
import { nextShowing, SHOWCASE_GRACE_MS } from './showcase';

const quiet = { heard: true, hasAgents: false, quietMs: 0 };

describe('nextShowing', () => {
  it('waits until it has heard from the relay', () => {
    expect(nextShowing('waiting', { ...quiet, heard: false })).toBe('waiting');
  });

  it('starts the demo at once when the office turns out to be empty', () => {
    expect(nextShowing('waiting', quiet)).toBe('demo');
  });

  it('shows the real office as soon as anyone is in it', () => {
    const facts = { ...quiet, hasAgents: true };
    expect(nextShowing('waiting', facts)).toBe('live');
    expect(nextShowing('demo', facts)).toBe('live');
    expect(nextShowing('live', facts)).toBe('live');
  });

  it('keeps the real office through a short gap', () => {
    expect(nextShowing('live', { ...quiet, quietMs: SHOWCASE_GRACE_MS - 1 })).toBe('live');
  });

  it('goes back to the demo once the gap has lasted', () => {
    expect(nextShowing('live', { ...quiet, quietMs: SHOWCASE_GRACE_MS })).toBe('demo');
  });

  it('stays on the demo while the office is empty', () => {
    expect(nextShowing('demo', { ...quiet, quietMs: SHOWCASE_GRACE_MS * 10 })).toBe('demo');
  });
});
