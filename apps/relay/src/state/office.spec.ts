import fc from 'fast-check';
import {
  CATEGORIES,
  EVENT_KINDS,
  rowsNeeded,
  ViewerMessageSchema,
  type IngestEvent,
} from '@hivefloor/schema';
import { describe, expect, it } from 'vitest';
import { CONFIG, event, NOW } from '../../test/helpers.js';
import type { OfficeState } from './model.js';
import { applyEvent, emptyOffice, nextWake, rollDay, tick, type Change } from './office.js';

const hidden = { ...CONFIG, privateRoom: { ...CONFIG.privateRoom, visible: false } };

/** Applies events in order, one second apart, collecting every message. */
function run(
  events: IngestEvent[],
  start: OfficeState = emptyOffice(CONFIG, NOW),
  config = CONFIG,
): Change {
  return events.reduce<Change>(
    (acc, e, i) => {
      const change = applyEvent(acc.state, e, NOW + i, config);
      return { state: change.state, messages: [...acc.messages, ...change.messages] };
    },
    { state: start, messages: [] },
  );
}

const sub = (overrides: Parameters<typeof event>[0] = {}) =>
  event({
    aid: '4be1d0',
    role: 'Explore',
    kind: 'spawn',
    cat: undefined,
    project: undefined,
    ...overrides,
  });

describe('applyEvent', () => {
  it('starts with the private room, or nothing when it is hidden (E1, H3)', () => {
    expect(emptyOffice(CONFIG, NOW).rooms).toEqual([
      { id: 'private', name: 'Private projects', color: '#8d94ab', slot: 0, rows: 1 },
    ]);
    expect(emptyOffice(hidden, NOW).rooms).toEqual([]);
  });

  it('opens a project room and seats the robot at a desk', () => {
    const { state, messages } = run([event({ goal: 'Building the paywall screen' })]);
    expect(state.rooms.find((r) => r.id === 'ledgerly')).toMatchObject({
      name: 'Ledgerly',
      color: '#f2a65a',
      group: 'mobile',
      slot: 1,
      rows: 1,
    });
    expect(messages).toEqual([
      {
        type: 'room',
        v: 1,
        room: {
          id: 'ledgerly',
          name: 'Ledgerly',
          color: '#f2a65a',
          slot: 1,
          floor: 0,
          rows: 1,
          lit: true,
          group: 'mobile',
        },
      },
      {
        type: 'delta',
        v: 1,
        robot: {
          key: 'a9f3c2',
          role: 'claude',
          room: 'ledgerly',
          status: 'working',
          since: NOW,
          desk: 0,
          goal: 'Building the paywall screen',
          cat: 'coding',
        },
      },
      { type: 'today', v: 1, count: { room: 'ledgerly', cat: 'coding', n: 1 } },
    ]);
  });

  it('maps kinds to statuses and keeps since while the status holds', () => {
    const { state, messages } = run([
      event({ kind: 'start', cat: undefined }),
      event({ seq: 2, kind: 'thinking', cat: undefined }),
      event({ seq: 3, kind: 'idle', cat: undefined }),
    ]);
    expect(messages.flatMap((m) => (m.type === 'delta' ? [m.robot.status] : []))).toEqual([
      'waiting',
      'thinking',
      'waiting',
    ]);
    const again = applyEvent(
      state,
      event({ seq: 4, kind: 'idle', cat: undefined }),
      NOW + 50,
      CONFIG,
    );
    expect(again.messages).toEqual([]);
    expect(again.state.robots[0]?.lastEventAt).toBe(NOW + 50);
  });

  it('ignores stale or repeated seq values (H5)', () => {
    const first = run([event({ seq: 5 })]);
    expect(applyEvent(first.state, event({ seq: 5, cat: 'testing' }), NOW + 9, CONFIG)).toEqual({
      state: first.state,
      messages: [],
    });
    expect(
      applyEvent(first.state, event({ seq: 4, cat: 'testing' }), NOW + 9, CONFIG).messages,
    ).toEqual([]);
  });

  it('adds a desk row when every desk is taken (E5)', () => {
    const { state, messages } = run(
      ['000001', '000002', '000003', '000004'].map((sid) => event({ sid })),
    );
    expect(state.robots.map((r) => r.desk)).toEqual([0, 1, 2, 3]);
    expect(state.rooms.find((r) => r.id === 'ledgerly')?.rows).toBe(2);
    expect(messages.filter((m) => m.type === 'room').at(-1)).toMatchObject({ room: { rows: 2 } });
  });

  it('seats subagents at the team table in the parent room (E6)', () => {
    const { state } = run([event(), sub(), sub({ aid: '5ce2e1', seq: 1 })]);
    const subs = state.robots.filter((r) => r.parent === 'a9f3c2');
    expect(subs.map((r) => [r.key, r.room, r.seat, r.status])).toEqual([
      ['a9f3c2:4be1d0', 'ledgerly', 0, 'thinking'],
      ['a9f3c2:5ce2e1', 'ledgerly', 1, 'thinking'],
    ]);
    expect(subs.every((r) => r.goal === undefined && r.desk === undefined)).toBe(true);
  });

  it('puts private sessions in the private room, or drops them when it is hidden', () => {
    expect(run([event({ project: undefined, goal: undefined })]).state.robots[0]?.room).toBe(
      'private',
    );
    expect(
      run([event({ project: undefined })], emptyOffice(hidden, NOW), hidden).state.robots,
    ).toEqual([]);
  });

  it('removes a session and its subagents on end, then repacks the empty office (H9, H13)', () => {
    const before = run([
      event({ project: 'Ndop UI' }),
      event({ sid: 'b00000' }),
      sub({ sid: 'b00000' }),
    ]);
    const leaveB = applyEvent(
      before.state,
      event({ sid: 'b00000', seq: 9, kind: 'end', cat: undefined }),
      NOW + 10,
      CONFIG,
    );
    expect(leaveB.messages.flatMap((m) => (m.type === 'leave' ? [m.key] : []))).toEqual([
      'b00000',
      'b00000:4be1d0',
    ]);
    expect(leaveB.state.departed.map((d) => d.key)).toEqual(['b00000', 'b00000:4be1d0']);
    expect(
      applyEvent(leaveB.state, event({ sid: 'b00000', seq: 8 }), NOW + 11, CONFIG).messages,
    ).toEqual([]);
    const empty = applyEvent(
      leaveB.state,
      event({ seq: 9, kind: 'end', cat: undefined }),
      NOW + 12,
      CONFIG,
    );
    expect(empty.state.robots).toEqual([]);
    expect(empty.messages.at(-1)).toMatchObject({ type: 'snapshot' });
    // Ndop UI opened first (slot 1); repacking orders rooms by id after the private room.
    expect(before.state.rooms.map((r) => [r.id, r.slot]).sort()).toEqual([
      ['ledgerly', 2],
      ['ndop-ui', 1],
      ['private', 0],
    ]);
    expect(empty.state.rooms.map((r) => [r.id, r.slot]).sort()).toEqual([
      ['ledgerly', 1],
      ['ndop-ui', 2],
      ['private', 0],
    ]);
  });

  it('removes only the subagent on done, and remembers an end for an unknown robot', () => {
    const before = run([event(), sub()]);
    const done = applyEvent(before.state, sub({ seq: 2, kind: 'done' }), NOW + 5, CONFIG);
    expect(done.state.robots.map((r) => r.key)).toEqual(['a9f3c2']);
    const unknown = applyEvent(
      before.state,
      event({ sid: 'c00000', seq: 3, kind: 'end', cat: undefined }),
      NOW + 5,
      CONFIG,
    );
    expect(unknown.state.departed).toEqual([{ key: 'c00000', seq: 3, at: NOW + 5 }]);
    expect(
      applyEvent(unknown.state, event({ sid: 'c00000', seq: 2 }), NOW + 6, CONFIG).messages,
    ).toEqual([]);
  });

  it('moves a robot whose project changes to a desk in the new room', () => {
    const { state } = run([
      event(),
      event({ sid: 'b00000', project: 'Ndop UI' }),
      event({ seq: 2, project: 'Ndop UI' }),
    ]);
    expect(state.robots.find((r) => r.key === 'a9f3c2')).toMatchObject({
      room: 'ndop-ui',
      desk: 1,
    });
  });

  it('counts tool events per room and category for today (R8)', () => {
    const { state, messages } = run([
      event(),
      event({ seq: 2 }),
      event({ seq: 3, cat: 'testing' }),
      event({ seq: 4, kind: 'thinking', cat: undefined }),
    ]);
    expect(state.today).toEqual([
      { room: 'ledgerly', cat: 'coding', n: 2 },
      { room: 'ledgerly', cat: 'testing', n: 1 },
    ]);
    expect(messages.flatMap((m) => (m.type === 'today' ? [m.count] : []))).toEqual([
      { room: 'ledgerly', cat: 'coding', n: 1 },
      { room: 'ledgerly', cat: 'coding', n: 2 },
      { room: 'ledgerly', cat: 'testing', n: 1 },
    ]);
  });

  it('keeps the goal on main sessions only and clears it when absent', () => {
    const { state } = run([event({ goal: 'Ship it' }), event({ seq: 2, cat: 'testing' })]);
    expect(state.robots[0]?.goal).toBeUndefined();
  });
});

describe('tick (R5)', () => {
  const start = run([event(), sub()]).state;

  it('marks robots idle, then away, then lets them leave', () => {
    // The subagent's last event was at NOW + 1.
    const idle = tick(start, NOW + 181, CONFIG);
    expect(idle.state.robots.map((r) => r.status)).toEqual(['idle', 'idle']);
    expect(idle.messages).toHaveLength(2);
    expect(idle.state.robots[0]?.cat).toBeUndefined();
    const away = tick(idle.state, NOW + 901, CONFIG);
    expect(away.state.robots.map((r) => r.status)).toEqual(['away', 'away']);
    expect(tick(away.state, NOW + 902, CONFIG).messages).toEqual([]);
    const gone = tick(away.state, NOW + 3601, CONFIG);
    expect(gone.state.robots).toEqual([]);
    expect(gone.messages.filter((m) => m.type === 'leave')).toHaveLength(2);
  });

  it('removes subagents whose session has left', () => {
    const orphaned = applyEvent(
      start,
      event({ seq: 2, kind: 'end', cat: undefined }),
      NOW + 1,
      CONFIG,
    ).state;
    expect(orphaned.robots).toEqual([]);
    const lone = run([sub()], emptyOffice(CONFIG, NOW)).state;
    const withTombstone = { ...lone, departed: [{ key: 'a9f3c2', seq: 1, at: NOW }] };
    expect(tick(withTombstone, NOW + 1, CONFIG).state.robots).toEqual([]);
  });

  it('removes trailing empty rows after the delay, never under a seated robot (H14)', () => {
    const four = run(['000001', '000002', '000003', '000004'].map((sid) => event({ sid }))).state;
    const left = applyEvent(
      four,
      event({ sid: '000004', seq: 2, kind: 'end', cat: undefined }),
      NOW + 10,
      CONFIG,
    ).state;
    expect(left.rooms.find((r) => r.id === 'ledgerly')).toMatchObject({
      rows: 2,
      surplusSince: NOW + 10,
    });
    expect(tick(left, NOW + 609, CONFIG).state.rooms.find((r) => r.id === 'ledgerly')?.rows).toBe(
      2,
    );
    const shrunk = tick(left, NOW + 610, CONFIG);
    expect(shrunk.state.rooms.find((r) => r.id === 'ledgerly')?.rows).toBe(1);
    expect(shrunk.messages).toContainEqual(expect.objectContaining({ type: 'room' }));
  });

  it('closes rooms empty for 30 minutes, but never the private room (E2)', () => {
    const both = run([event(), event({ sid: 'b00000', project: undefined })]).state;
    const emptied = applyEvent(
      applyEvent(both, event({ seq: 2, kind: 'end', cat: undefined }), NOW + 5, CONFIG).state,
      event({ sid: 'b00000', seq: 2, kind: 'end', cat: undefined }),
      NOW + 5,
      CONFIG,
    ).state;
    const closed = tick(emptied, NOW + 5 + 1800, CONFIG);
    expect(closed.state.rooms.map((r) => r.id)).toEqual(['private']);
    expect(closed.messages).toContainEqual({ type: 'roomClosed', v: 1, id: 'ledgerly' });
    expect(closed.state.departed).toEqual([]);
  });
});

describe('rollDay (R8, H13)', () => {
  it('resets counts and repacks on a new UTC day, sending a snapshot', () => {
    const busy = run([event({ project: 'Ndop UI' }), event({ sid: 'b00000' })]).state;
    const moved = {
      ...busy,
      rooms: busy.rooms.map((r) => (r.id === 'private' ? { ...r, slot: 5 } : r)),
    };
    expect(rollDay(moved, NOW + 10, CONFIG).messages).toEqual([]);
    const next = rollDay(moved, NOW + 86_400, CONFIG);
    expect(next.state.today).toEqual([]);
    expect(next.state.day).toBe('2026-11-09');
    expect(next.state.rooms.map((r) => [r.id, r.slot]).sort()).toEqual([
      ['ledgerly', 1],
      ['ndop-ui', 2],
      ['private', 0],
    ]);
    expect(next.messages[0]).toMatchObject({ type: 'snapshot', today: [] });
  });
});

describe('nextWake', () => {
  it('schedules nothing for an empty office and the earliest threshold otherwise', () => {
    expect(nextWake(emptyOffice(CONFIG, NOW), CONFIG)).toBeUndefined();
    const one = run([event()]).state;
    expect(nextWake(one, CONFIG)).toBe(NOW + 180);
    const lone = run([sub()]).state;
    expect(nextWake({ ...lone, departed: [{ key: 'a9f3c2', seq: 1, at: NOW }] }, CONFIG)).toBe(0);
  });
});

describe('invariants (property)', () => {
  const sids = ['a00001', 'a00002', 'a00003', 'a00004', 'a00005', 'a00006'];
  const eventArb = fc.record({
    sid: fc.constantFrom(...sids),
    aid: fc.option(fc.constantFrom('b00001', 'b00002', 'b00003'), { nil: undefined }),
    kind: fc.constantFrom(...EVENT_KINDS),
    cat: fc.constantFrom(...CATEGORIES),
    project: fc.option(fc.constantFrom('Ledgerly', 'Ndop UI', 'Builderswave'), { nil: undefined }),
    seq: fc.nat(30),
    dt: fc.nat(400),
  });

  it('never shares a desk, seat or slot, keeps rooms for every robot and sends schema-valid messages', () => {
    fc.assert(
      fc.property(fc.array(eventArb, { maxLength: 80 }), fc.boolean(), (raw, withTicks) => {
        let state = emptyOffice(CONFIG, NOW);
        let now = NOW;
        for (const r of raw) {
          now += r.dt;
          const isSub = r.aid !== undefined && r.kind !== 'start' && r.kind !== 'end';
          const kind = isSub
            ? r.kind === 'start' || r.kind === 'end'
              ? 'tool'
              : r.kind
            : r.kind === 'spawn' || r.kind === 'done'
              ? 'tool'
              : r.kind;
          const e = event({
            sid: r.sid,
            seq: r.seq,
            t: now,
            kind,
            cat: kind === 'tool' ? r.cat : undefined,
            project: r.project,
            goal: undefined,
            ...(isSub ? { aid: r.aid, role: 'Explore' } : {}),
          });
          const changes = [applyEvent(state, e, now, CONFIG)];
          if (withTicks) changes.push(tick(changes[0]?.state ?? state, now, CONFIG));
          for (const change of changes) {
            for (const message of change.messages)
              expect(ViewerMessageSchema.safeParse(message).success).toBe(true);
            state = change.state;
          }
          const roomIds = new Set(state.rooms.map((room) => room.id));
          expect(new Set(state.rooms.map((room) => room.slot)).size).toBe(state.rooms.length);
          for (const room of state.rooms) {
            const inRoom = state.robots.filter((robot) => robot.room === room.id);
            const desks = inRoom.flatMap((robot) => (robot.desk === undefined ? [] : [robot.desk]));
            const seats = inRoom.flatMap((robot) => (robot.seat === undefined ? [] : [robot.seat]));
            expect(new Set(desks).size).toBe(desks.length);
            expect(new Set(seats).size).toBe(seats.length);
            expect(room.rows).toBeGreaterThanOrEqual(rowsNeeded(desks, CONFIG.layout));
          }
          for (const robot of state.robots) expect(roomIds.has(robot.room)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});
