import { describe, expect, it } from 'vitest';
import { msg, robot, ROOMS, SNAPSHOT } from '../../test/fixtures';
import {
  activity,
  applyMessage,
  EMPTY_OFFICE,
  NEUTRAL_ROOM_COLOR,
  roomColor,
  roomName,
  robotName,
  totalsByRoom,
} from './office-view';

describe('applyMessage', () => {
  const start = applyMessage(EMPTY_OFFICE, msg(SNAPSHOT)).view;

  it('replaces the view on a snapshot', () => {
    expect(start).toMatchObject({
      at: 100,
      rooms: ROOMS,
      today: [{ room: 'ledgerly', cat: 'coding', n: 3 }],
    });
    expect(start.robots).toHaveLength(1);
  });

  it('upserts and closes rooms', () => {
    const room = {
      id: 'ndop-ui',
      name: 'Ndop UI',
      color: '#b79cf2',
      slot: 2,
      floor: 0,
      rows: 1,
      lit: true,
    };
    const opened = applyMessage(start, msg({ type: 'room', v: 1, room })).view;
    expect(opened.rooms.map((r) => r.id)).toEqual(['private', 'ledgerly', 'ndop-ui']);
    const grown = applyMessage(
      opened,
      msg({ type: 'room', v: 1, room: { ...room, rows: 2 } }),
    ).view;
    expect(grown.rooms.find((r) => r.id === 'ndop-ui')?.rows).toBe(2);
    expect(
      applyMessage(grown, msg({ type: 'roomClosed', v: 1, id: 'ndop-ui' })).view.rooms,
    ).toHaveLength(2);
  });

  it('reports robots arriving, changing and leaving', () => {
    const arrived = applyMessage(
      start,
      msg({
        type: 'delta',
        v: 1,
        robot: {
          key: 'b00000',
          role: 'claude',
          room: 'private',
          desk: 0,
          status: 'thinking',
          since: 101,
        },
      }),
    );
    expect(arrived.changes.map((c) => [c.before, c.after?.key])).toEqual([[undefined, 'b00000']]);
    const changed = applyMessage(
      arrived.view,
      msg({
        type: 'delta',
        v: 1,
        robot: {
          key: 'b00000',
          role: 'claude',
          room: 'private',
          desk: 0,
          status: 'working',
          cat: 'testing',
          since: 102,
        },
      }),
    );
    expect(changed.changes[0]?.before?.status).toBe('thinking');
    expect(changed.view.robots).toHaveLength(2);
    const left = applyMessage(changed.view, msg({ type: 'leave', v: 1, key: 'b00000' }));
    expect(left.view.robots).toHaveLength(1);
    expect(left.changes.map((c) => [c.before?.key, c.after])).toEqual([['b00000', undefined]]);
    expect(applyMessage(left.view, msg({ type: 'leave', v: 1, key: 'b00000' })).changes).toEqual(
      [],
    );
  });

  it('updates today counts and ignores status messages', () => {
    const counted = applyMessage(
      start,
      msg({ type: 'today', v: 1, count: { room: 'ledgerly', cat: 'coding', n: 4 } }),
    ).view;
    expect(counted.today).toEqual([{ room: 'ledgerly', cat: 'coding', n: 4 }]);
    const added = applyMessage(
      counted,
      msg({ type: 'today', v: 1, count: { room: 'private', cat: 'vcs', n: 1 } }),
    ).view;
    expect(added.today).toHaveLength(2);
    expect(applyMessage(start, msg({ type: 'status', v: 1, state: 'busy' })).view).toBe(start);
  });
});

describe('labels', () => {
  it('names robots and rooms, hiding private room names', () => {
    expect(robotName(robot())).toBe('Claude');
    expect(
      robotName(
        robot({
          key: 'a9f3c2:4be1d0',
          parent: 'a9f3c2',
          role: 'Explore',
          desk: undefined,
          seat: 0,
        }),
      ),
    ).toBe('Explore');
    expect(roomName(robot(), ROOMS)).toBe('Ledgerly');
    expect(roomName(robot({ room: 'private' }), ROOMS)).toBe('Private project');
    expect(roomName(robot({ room: 'gone' }), ROOMS)).toBe('gone');
  });

  it('describes activities', () => {
    expect(activity(robot({ cat: 'testing' }))).toBe('running tests');
    expect(activity(robot({ status: 'idle', cat: undefined }))).toBe('on a coffee break');
    expect(activity(robot({ status: 'working', cat: undefined }))).toBe('working');
  });
});

describe('totalsByRoom', () => {
  it('adds up each room and puts the busiest first', () => {
    expect(
      totalsByRoom([
        { room: 'a', cat: 'coding', n: 2 },
        { room: 'b', cat: 'coding', n: 5 },
        { room: 'a', cat: 'vcs', n: 1 },
        { room: 'c', cat: 'vcs', n: 3 },
      ] as unknown as Parameters<typeof totalsByRoom>[0]),
    ).toEqual([
      { room: 'b', n: 5 },
      { room: 'a', n: 3 },
      { room: 'c', n: 3 },
    ]);
  });
});

describe('roomColor', () => {
  it('uses the room colour, or a neutral one for an unknown room', () => {
    expect(roomColor(robot(), ROOMS)).toBe('#f2a65a');
    expect(roomColor(robot(), [])).toBe(NEUTRAL_ROOM_COLOR);
  });
});
