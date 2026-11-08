import { describe, expect, it } from 'vitest';
import { daySalt, fileKey, shortHash, subagentRole, utcDay } from './identity.js';

describe('identity (C6, H7)', () => {
  it('gives the UTC day', () => {
    expect(utcDay(1794096000)).toBe('2026-11-08');
    expect(utcDay(1794095999)).toBe('2026-11-07');
  });

  it('hashes ids to 6 lowercase hex characters', () => {
    const hash = shortHash(daySalt('secret', '2026-11-08'), 'session-1');
    expect(hash).toMatch(/^[0-9a-f]{6}$/);
    expect(shortHash(daySalt('secret', '2026-11-08'), 'session-1')).toBe(hash);
  });

  it('changes the hash with the day and the secret', () => {
    const today = shortHash(daySalt('secret', '2026-11-08'), 'session-1');
    expect(shortHash(daySalt('secret', '2026-11-09'), 'session-1')).not.toBe(today);
    expect(shortHash(daySalt('other', '2026-11-08'), 'session-1')).not.toBe(today);
  });

  it('makes local file keys', () => {
    expect(fileKey('session-1')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('shows only listed subagent types, otherwise Helper', () => {
    expect(subagentRole('Explore', ['Explore'])).toBe('Explore');
    expect(subagentRole('acme-internal-reviewer', ['Explore'])).toBe('Helper');
    expect(subagentRole(undefined, ['Explore'])).toBe('Helper');
    expect(subagentRole('claude', ['claude'])).toBe('Helper');
  });
});
