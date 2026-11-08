import { describe, expect, it } from 'vitest';
import { exampleOfficeConfig } from './fixtures/index.js';
import { DEFAULT_LAYOUT_LIMITS, isTimeZone, OfficeConfigSchema } from './office-config.js';

const minimal = { v: 1, owner: 'Ada', timezone: 'UTC' };

function issuesOf(input: unknown): string[] {
  const result = OfficeConfigSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('OfficeConfigSchema', () => {
  it('accepts the PRD example', () => {
    expect(OfficeConfigSchema.parse(exampleOfficeConfig)).toMatchObject({
      title: 'Hivefloor',
      viewerCap: 500,
    });
  });

  it('fills every default from a minimal config', () => {
    const config = OfficeConfigSchema.parse(minimal);
    expect(config).toEqual({
      v: 1,
      title: 'Hivefloor',
      owner: 'Ada',
      timezone: 'UTC',
      publicProjects: [],
      privateRoom: { name: 'Private projects', color: '#8d94ab', visible: true },
      agentTypes: ['Helper'],
      presence: { idleAfterSec: 180, awayAfterSec: 900, leaveAfterSec: 3600 },
      layout: DEFAULT_LAYOUT_LIMITS,
      viewerCap: 500,
    });
  });

  it('keeps the PRD default layout limits', () => {
    expect(DEFAULT_LAYOUT_LIMITS).toEqual(exampleOfficeConfig.layout);
  });

  it('can hide the private room (H3)', () => {
    const config = OfficeConfigSchema.parse({ ...minimal, privateRoom: { visible: false } });
    expect(config.privateRoom).toEqual({
      name: 'Private projects',
      color: '#8d94ab',
      visible: false,
    });
  });

  it.each([
    ['unknown top-level key', { ...minimal, secret: 'x' }, ''],
    ['wrong version', { ...minimal, v: 2 }, 'v'],
    ['missing owner', { v: 1, timezone: 'UTC' }, 'owner'],
    ['blank owner', { ...minimal, owner: '   ' }, 'owner'],
    ['owner with a newline', { ...minimal, owner: 'A\nB' }, 'owner'],
    ['unknown time zone', { ...minimal, timezone: 'Mars/Olympus' }, 'timezone'],
    [
      'bad colour',
      { ...minimal, publicProjects: [{ name: 'A', color: 'red' }] },
      'publicProjects.0.color',
    ],
    [
      'bad group',
      { ...minimal, publicProjects: [{ name: 'A', group: 'Web App' }] },
      'publicProjects.0.group',
    ],
    [
      'unknown project key',
      { ...minimal, publicProjects: [{ name: 'A', path: '~/a' }] },
      'publicProjects.0',
    ],
    ['agent type "claude"', { ...minimal, agentTypes: ['claude'] }, 'agentTypes.0'],
    ['agent type with spaces', { ...minimal, agentTypes: ['code reviewer'] }, 'agentTypes.0'],
    ['duplicate agent types', { ...minimal, agentTypes: ['Plan', 'Plan'] }, 'agentTypes'],
    [
      'idle after away',
      { ...minimal, presence: { idleAfterSec: 900, awayAfterSec: 600 } },
      'presence.awayAfterSec',
    ],
    [
      'away after leave',
      { ...minimal, presence: { awayAfterSec: 900, leaveAfterSec: 600 } },
      'presence.leaveAfterSec',
    ],
    ['odd rooms per floor', { ...minimal, layout: { roomsPerFloor: 7 } }, 'layout.roomsPerFloor'],
    ['zero viewer cap', { ...minimal, viewerCap: 0 }, 'viewerCap'],
    ['fractional seats', { ...minimal, layout: { tableSeats: 2.5 } }, 'layout.tableSeats'],
  ])('rejects %s', (_label, input, path) => {
    expect(issuesOf(input)).toContain(path);
  });

  describe('project names (H15)', () => {
    it('rejects duplicate names, ignoring case', () => {
      const input = { ...minimal, publicProjects: [{ name: 'Ledgerly' }, { name: 'ledgerly' }] };
      expect(issuesOf(input)).toEqual(['publicProjects.1.name']);
    });

    it('rejects names that give the same room id', () => {
      const input = { ...minimal, publicProjects: [{ name: 'Ndop UI' }, { name: 'Ndop-UI' }] };
      expect(issuesOf(input)).toEqual(['publicProjects.1.name']);
    });

    it.each(['Private', 'Other', '🚀'])('rejects %j as a project name', (name) => {
      expect(issuesOf({ ...minimal, publicProjects: [{ name }] })).toEqual([
        'publicProjects.0.name',
      ]);
    });
  });
});

describe('isTimeZone', () => {
  it('knows IANA zones', () => {
    expect(isTimeZone('Africa/Douala')).toBe(true);
    expect(isTimeZone('Nowhere/Land')).toBe(false);
  });
});

describe('office.config.example.json', () => {
  it('is the PRD example and is valid', async () => {
    const { readFile } = await import('node:fs/promises');
    const url = new URL('../../../office.config.example.json', import.meta.url);
    const example: unknown = JSON.parse(await readFile(url, 'utf8'));
    expect(example).toEqual(exampleOfficeConfig);
    expect(OfficeConfigSchema.safeParse(example).success).toBe(true);
  });
});
