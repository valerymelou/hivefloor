import { describe, expect, it } from 'vitest';
import { testConfig } from '../test/payloads.js';
import { clockCheck, formatChecks, hooksCheck, ingestCheck, namesChecks } from './doctor.js';
import { HOOK_EVENTS } from './settings.js';

const now = Date.parse('2026-11-08T00:00:00Z');

describe('clockCheck (H8)', () => {
  it('is ok within 30 s and warns beyond, in either direction', () => {
    expect(clockCheck(now, new Date(now - 10_000).toUTCString()).status).toBe('ok');
    const ahead = clockCheck(now, new Date(now - 45_000).toUTCString());
    expect(ahead.status).toBe('warn');
    expect(ahead.detail).toContain('45 s ahead');
    expect(clockCheck(now, new Date(now + 90_000).toUTCString()).detail).toContain('90 s behind');
    expect(clockCheck(now, null).status).toBe('warn');
    expect(clockCheck(now, 'not a date').status).toBe('warn');
  });
});

describe('namesChecks (H4)', () => {
  const machine = testConfig({ publicAgentTypes: ['Explore', 'Reviewer'] });

  it('passes when the relay knows every public name', () => {
    const office = {
      publicProjects: [{ name: 'Ledgerly' }],
      agentTypes: ['Explore', 'Reviewer', 'Helper'],
    };
    expect(namesChecks(machine, office).map((c) => c.status)).toEqual(['ok', 'ok']);
  });

  it('flags unknown projects and agent types', () => {
    const [projects, agents] = namesChecks(machine, {
      publicProjects: [{ name: 'ledgerly' }, 'junk'],
      agentTypes: ['Explore', 3],
    });
    expect(projects?.status).toBe('fail');
    expect(projects?.detail).toContain('Ledgerly');
    expect(agents?.status).toBe('warn');
    expect(agents?.detail).toContain('Reviewer');
    expect(namesChecks(machine, 'not an object')[0]?.status).toBe('fail');
  });
});

describe('ingestCheck', () => {
  it.each([
    [204, 'ok'],
    [200, 'ok'],
    [401, 'fail'],
    [403, 'fail'],
    [400, 'fail'],
    [422, 'fail'],
    [404, 'fail'],
    [413, 'fail'],
    [429, 'warn'],
    [undefined, 'fail'],
    [500, 'fail'],
  ])('%s → %s', (status, expected) => {
    expect(ingestCheck(status).status).toBe(expected);
  });
});

describe('hooksCheck', () => {
  const all = HOOK_EVENTS.map((event) => ({ event, command: 'hivefloor hook', async: true }));

  it('passes when every event has the same async hook', () => {
    expect(hooksCheck(all).status).toBe('ok');
  });

  it('reports missing, sync or inconsistent hooks', () => {
    expect(hooksCheck([]).status).toBe('fail');
    expect(hooksCheck(all.slice(1)).detail).toContain('SessionStart');
    expect(hooksCheck(all.map((h, i) => (i === 0 ? { ...h, async: false } : h))).status).toBe(
      'warn',
    );
    expect(
      hooksCheck(all.map((h, i) => (i === 0 ? { ...h, command: 'other hivefloor hook' } : h)))
        .detail,
    ).toContain('different commands');
  });
});

describe('formatChecks', () => {
  it('prints one marked line per check', () => {
    expect(
      formatChecks([
        { status: 'ok', title: 'A' },
        { status: 'warn', title: 'B', detail: 'b' },
        { status: 'fail', title: 'C' },
      ]),
    ).toBe('✓ A\n! B: b\n✗ C');
  });
});
