import fc from 'fast-check';
import { CATEGORIES, EVENT_KINDS, INGEST_EVENT_FIELDS } from '@hivefloor/schema';
import { describe, expect, it } from 'vitest';
import { buildEvent, roundTimestamp } from './event.js';

describe('buildEvent (C3)', () => {
  it('builds the PRD example', () => {
    expect(
      buildEvent({
        t: 1794091200,
        seq: 12,
        sid: 'a9f3c2',
        role: 'claude',
        kind: 'tool',
        cat: 'testing',
        project: 'Ledgerly',
        goal: 'Building the paywall screen',
      }),
    ).toEqual({
      v: 1,
      t: 1794091200,
      seq: 12,
      sid: 'a9f3c2',
      role: 'claude',
      kind: 'tool',
      cat: 'testing',
      project: 'Ledgerly',
      goal: 'Building the paywall screen',
    });
  });

  it('drops a goal without a project and a category outside tool events', () => {
    expect(
      buildEvent({
        t: 1,
        seq: 0,
        sid: 'a9f3c2',
        role: 'claude',
        kind: 'idle',
        cat: 'coding',
        goal: 'x',
      }),
    ).toEqual({
      v: 1,
      t: 1,
      seq: 0,
      sid: 'a9f3c2',
      role: 'claude',
      kind: 'idle',
    });
  });

  it('only ever writes allowlisted keys', () => {
    fc.assert(
      fc.property(
        fc.record(
          {
            t: fc.nat(),
            seq: fc.nat(),
            sid: fc.string(),
            aid: fc.string(),
            role: fc.string(),
            kind: fc.constantFrom(...EVENT_KINDS),
            cat: fc.constantFrom(...CATEGORIES),
            project: fc.string(),
            goal: fc.string(),
          },
          { requiredKeys: ['t', 'seq', 'sid', 'role', 'kind'] },
        ),
        (facts) => {
          for (const key of Object.keys(buildEvent(facts)))
            expect(INGEST_EVENT_FIELDS).toContain(key);
        },
      ),
    );
  });
});

describe('roundTimestamp', () => {
  it('rounds down to the step', () => {
    expect(roundTimestamp(1794091204, 5)).toBe(1794091200);
    expect(roundTimestamp(1794091259, 60)).toBe(1794091200);
  });
});
