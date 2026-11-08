import type { Robot, Room, ViewerMessage } from '@hivefloor/schema';
import { ViewerMessageSchema } from '@hivefloor/schema';

/** Parses a message literal, so tests use real, branded contract types. */
export function msg(input: unknown): ViewerMessage {
  return ViewerMessageSchema.parse(input);
}

export const ROOMS: Room[] = [
  {
    id: 'private',
    name: 'Private projects',
    color: '#8d94ab',
    slot: 0,
    floor: 0,
    rows: 1,
    lit: true,
  },
  { id: 'ledgerly', name: 'Ledgerly', color: '#f2a65a', slot: 1, floor: 0, rows: 1, lit: true },
] as Room[];

export function robot(overrides: Partial<Record<keyof Robot, unknown>> = {}): Robot {
  const input = {
    key: 'a9f3c2',
    role: 'claude',
    room: 'ledgerly',
    desk: 0,
    status: 'working',
    cat: 'coding',
    since: 100,
    ...overrides,
  };
  const message = msg({ type: 'delta', v: 1, robot: input });
  if (message.type !== 'delta') throw new Error('not a delta');
  return message.robot;
}

export const SNAPSHOT = {
  type: 'snapshot',
  v: 1,
  at: 100,
  rooms: ROOMS,
  robots: [
    {
      key: 'a9f3c2',
      role: 'claude',
      room: 'ledgerly',
      desk: 0,
      goal: 'Building the paywall screen',
      status: 'working',
      cat: 'coding',
      since: 90,
    },
  ],
  today: [{ room: 'ledgerly', cat: 'coding', n: 3 }],
};
