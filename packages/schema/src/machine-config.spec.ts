import { describe, expect, it } from 'vitest';
import { exampleMachineConfig } from './fixtures/index.js';
import { DEFAULT_BLOCK_WORDS, isEndpointUrl, MachineConfigSchema } from './machine-config.js';

const minimal = { v: 1, endpoint: 'https://office.example.com/ingest' };

function issuesOf(input: unknown): string[] {
  const result = MachineConfigSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('MachineConfigSchema', () => {
  it('accepts the PRD example', () => {
    expect(MachineConfigSchema.parse(exampleMachineConfig).projects).toHaveLength(2);
  });

  it('fills every default from a minimal config', () => {
    expect(MachineConfigSchema.parse(minimal)).toEqual({
      v: 1,
      endpoint: 'https://office.example.com/ingest',
      projects: [],
      publicAgentTypes: [],
      goals: {
        fromTaskList: true,
        fromSessionTitle: true,
        maxLength: 60,
        blockWords: [...DEFAULT_BLOCK_WORDS],
        privatePrefix: '[private]',
      },
      mcpCategories: {},
      timestampRoundingSec: 5,
      paused: false,
    });
  });

  it('accepts a private project without a name', () => {
    expect(issuesOf({ ...minimal, projects: [{ path: '~/client', public: false }] })).toEqual([]);
  });

  it.each([
    ['unknown key', { ...minimal, secret: 'abc' }, ''],
    [
      'plain http endpoint',
      { ...minimal, endpoint: 'http://office.example.com/ingest' },
      'endpoint',
    ],
    ['not a URL', { ...minimal, endpoint: 'office' }, 'endpoint'],
    [
      'public project without a name',
      { ...minimal, projects: [{ path: '~/a', public: true }] },
      'projects.0.name',
    ],
    ['empty path', { ...minimal, projects: [{ path: '', public: false }] }, 'projects.0.path'],
    [
      'unknown category',
      { ...minimal, mcpCategories: { Figma: 'drawing' } },
      'mcpCategories.Figma',
    ],
    ['goal length over 60', { ...minimal, goals: { maxLength: 80 } }, 'goals.maxLength'],
    ['rounding over 60 s', { ...minimal, timestampRoundingSec: 120 }, 'timestampRoundingSec'],
    ['agent type "claude"', { ...minimal, publicAgentTypes: ['claude'] }, 'publicAgentTypes.0'],
  ])('rejects %s', (_label, input, path) => {
    expect(issuesOf(input)).toContain(path);
  });
});

describe('isEndpointUrl', () => {
  it.each([
    ['https://office.example.com/ingest', true],
    ['http://localhost:8787/ingest', true],
    ['http://127.0.0.1:8787/ingest', true],
    ['http://[::1]:8787/ingest', true],
    ['http://example.com/ingest', false],
    ['ftp://example.com', false],
    ['not a url', false],
  ])('%s → %s', (url, ok) => {
    expect(isEndpointUrl(url)).toBe(ok);
  });
});
