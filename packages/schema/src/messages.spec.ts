import { describe, expect, it } from 'vitest';
import { exampleViewerMessages } from './fixtures/index.js';
import { RobotSchema, ViewerMessageSchema } from './messages.js';

const main = {
  key: 'a9f3c2',
  role: 'claude',
  room: 'ledgerly',
  desk: 0,
  status: 'working',
  cat: 'coding',
  since: 1,
};
const sub = {
  key: 'a9f3c2:4be1d0',
  parent: 'a9f3c2',
  role: 'Explore',
  room: 'ledgerly',
  seat: 0,
  status: 'idle',
  since: 1,
};

function issuesOf(input: unknown): string[] {
  const result = RobotSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('ViewerMessageSchema', () => {
  it.each(exampleViewerMessages.map((m) => [m.type, m] as const))(
    'accepts the %s example',
    (_type, message) => {
      expect(ViewerMessageSchema.parse(message)).toEqual(message);
    },
  );

  it.each([
    ['an unknown type', { type: 'hello', v: 1 }],
    ['an unknown field', { type: 'leave', v: 1, key: 'a9f3c2', extra: true }],
    ['a bad room id', { type: 'roomClosed', v: 1, id: 'Ndop UI' }],
    ['an unknown state', { type: 'status', v: 1, state: 'closed' }],
    [
      'zero rows',
      {
        type: 'room',
        v: 1,
        room: { id: 'a', name: 'A', color: '#000000', slot: 0, floor: 0, rows: 0, lit: true },
      },
    ],
    [
      'a negative count',
      {
        type: 'snapshot',
        v: 1,
        at: 1,
        rooms: [],
        robots: [],
        today: [{ room: 'a', cat: 'coding', n: -1 }],
      },
    ],
  ])('rejects %s', (_label, message) => {
    expect(ViewerMessageSchema.safeParse(message).success).toBe(false);
  });
});

describe('RobotSchema', () => {
  it('accepts a main session and a subagent', () => {
    expect(issuesOf(main)).toEqual([]);
    expect(issuesOf(sub)).toEqual([]);
  });

  it.each([
    ['a main session with a seat', { ...main, seat: 1 }, 'desk'],
    ['a main session without a desk', { ...main, desk: undefined }, 'desk'],
    ['a subagent with a desk', { ...sub, desk: 1 }, 'seat'],
    ['a subagent without a seat', { ...sub, seat: undefined }, 'seat'],
    ['a subagent key without a parent', { ...sub, parent: undefined }, 'parent'],
    ['a main key with a parent', { ...main, parent: 'b00000' }, 'parent'],
    ['a parent that is not the key prefix', { ...sub, parent: 'b00000' }, 'parent'],
    ['an unknown status', { ...main, status: 'sleeping' }, 'status'],
  ])('rejects %s', (_label, robot, path) => {
    expect(issuesOf(robot)).toContain(path);
  });
});
