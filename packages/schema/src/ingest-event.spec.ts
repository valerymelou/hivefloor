import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, EVENT_KINDS } from './constants.js';
import { exampleIngestEvents } from './fixtures/index.js';
import { INGEST_EVENT_FIELDS, IngestEventSchema } from './ingest-event.js';

const tool = {
  v: 1,
  t: 1794091200,
  seq: 1,
  sid: 'a9f3c2',
  role: 'claude',
  kind: 'tool',
  cat: 'coding',
};
const subagent = {
  v: 1,
  t: 1794091200,
  seq: 1,
  sid: 'a9f3c2',
  aid: '4be1d0',
  role: 'Explore',
  kind: 'spawn',
};

function issuesOf(input: unknown): string[] {
  const result = IngestEventSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('IngestEventSchema', () => {
  it.each(exampleIngestEvents.map((event) => [event.kind, event] as const))(
    'accepts the %s example',
    (_k, event) => {
      expect(IngestEventSchema.parse(event)).toEqual(event);
    },
  );

  it('allows exactly the fields of the PRD contract', () => {
    expect([...INGEST_EVENT_FIELDS].sort()).toEqual(
      ['aid', 'cat', 'goal', 'kind', 'project', 'role', 'seq', 'sid', 't', 'v'].sort(),
    );
  });

  it.each([
    ['an unknown field', { ...tool, cwd: '/home/ada/client' }, ''],
    ['a raw session id', { ...tool, sid: '3f0c9e8a-1b2c-4d5e-8f90-123456789abc' }, 'sid'],
    ['an uppercase hash', { ...tool, sid: 'A9F3C2' }, 'sid'],
    ['a missing seq', { ...tool, seq: undefined }, 'seq'],
    ['a negative seq', { ...tool, seq: -1 }, 'seq'],
    ['a fractional time', { ...tool, t: 1794091200.5 }, 't'],
    ['version 2', { ...tool, v: 2 }, 'v'],
    ['an unknown kind', { ...tool, kind: 'typing' }, 'kind'],
    ['an unknown category', { ...tool, cat: 'hacking' }, 'cat'],
    ['a tool event without a category', { ...tool, cat: undefined }, 'cat'],
    ['a category on a non-tool event', { ...tool, kind: 'thinking' }, 'cat'],
    ['a goal without a project', { ...tool, goal: 'Building the paywall' }, 'goal'],
    ['a goal over 60 characters', { ...tool, project: 'Ledgerly', goal: 'x'.repeat(61) }, 'goal'],
    [
      'a goal with a link',
      { ...tool, project: 'Ledgerly', goal: 'Read https://evil.example' },
      'goal',
    ],
    ['a goal with a newline', { ...tool, project: 'Ledgerly', goal: 'Line\nbreak' }, 'goal'],
    ['a main session with a subagent role', { ...tool, role: 'Explore' }, 'role'],
    ['a subagent with role claude', { ...subagent, role: 'claude' }, 'role'],
    ['a spawn without aid', { ...tool, kind: 'spawn', cat: undefined }, 'aid'],
    ['a start with aid', { ...subagent, kind: 'start' }, 'aid'],
    ['a role with markup', { ...subagent, role: '<script>' }, 'role'],
  ])('rejects %s', (_label, input, path) => {
    expect(issuesOf(input)).toContain(path);
  });

  it('never accepts a key outside the allowlist (privacy property)', () => {
    const extraKey = fc
      .string({ minLength: 1 })
      .filter((key) => !INGEST_EVENT_FIELDS.includes(key));
    fc.assert(
      fc.property(extraKey, fc.jsonValue(), (key, value) => {
        expect(IngestEventSchema.safeParse({ ...tool, [key]: value }).success).toBe(false);
      }),
    );
  });

  it('parses every valid kind and category combination', () => {
    fc.assert(
      fc.property(fc.constantFrom(...EVENT_KINDS), fc.constantFrom(...CATEGORIES), (kind, cat) => {
        const isSubagent = kind === 'spawn' || kind === 'done';
        const event = {
          ...(isSubagent ? subagent : tool),
          kind,
          cat: kind === 'tool' ? cat : undefined,
        };
        expect(IngestEventSchema.safeParse(event).success).toBe(true);
      }),
    );
  });
});
