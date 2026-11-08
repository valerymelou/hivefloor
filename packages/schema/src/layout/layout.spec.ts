import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT_LIMITS, type LayoutLimits } from '../office-config.js';
import { layout, type LayoutRobot, type LayoutRoom } from './layout.js';

const limits = DEFAULT_LAYOUT_LIMITS;

const room = (id: string, slot: number, rows = 1, group?: string): LayoutRoom => ({
  id,
  slot,
  rows,
  ...(group === undefined ? {} : { group }),
});

const robot = (
  key: string,
  roomId: string,
  at: number,
  place: { desk: number } | { seat: number },
): LayoutRobot => ({
  key,
  room: roomId,
  lastActiveAt: at,
  ...place,
});

describe('layout', () => {
  it('places rooms by slot and robots at their desks and seats', () => {
    const result = layout(
      [room('private', 1, 2), room('ledgerly', 0, 1, 'mobile')],
      [
        robot('a9f3c2', 'ledgerly', 10, { desk: 0 }),
        robot('a9f3c2:4be1d0', 'ledgerly', 11, { seat: 0 }),
        robot('7d01aa', 'private', 5, { desk: 4 }),
      ],
      limits,
    );
    expect(result.floors).toBe(1);
    expect(result.rooms).toEqual([
      {
        id: 'ledgerly',
        slot: 0,
        floor: 0,
        bay: 0,
        side: 'left',
        rows: 1,
        depthRows: 2,
        group: 'mobile',
        folded: [],
        hiddenRobots: 0,
      },
      {
        id: 'private',
        slot: 1,
        floor: 0,
        bay: 0,
        side: 'right',
        rows: 2,
        depthRows: 2,
        folded: [],
        hiddenRobots: 0,
      },
    ]);
    expect(result.robots).toEqual([
      { key: '7d01aa', room: 'private', spot: { kind: 'desk', index: 4, standing: false } },
      { key: 'a9f3c2', room: 'ledgerly', spot: { kind: 'desk', index: 0, standing: false } },
      { key: 'a9f3c2:4be1d0', room: 'ledgerly', spot: { kind: 'seat', index: 0, standing: false } },
    ]);
  });

  it('starts a new floor at the ninth room (E4)', () => {
    const rooms = Array.from({ length: 9 }, (_, i) => room(`r${String(i)}`, i));
    const result = layout(rooms, [], limits);
    expect(result.floors).toBe(2);
    expect(result.rooms.at(-1)).toMatchObject({ id: 'r8', floor: 1, bay: 0 });
  });

  it('has robots stand beyond the last desk and the last table seat (E5, E6)', () => {
    const result = layout(
      [room('a', 0, 4)],
      [robot('aaaaaa', 'a', 1, { desk: 12 }), robot('aaaaaa:bbbbbb', 'a', 1, { seat: 6 })],
      limits,
    );
    expect(result.robots.map((r) => r.spot.standing)).toEqual([true, true]);
  });

  it('shows the least recently active robots as "+N" beyond the robot cap (E8)', () => {
    const small = { ...limits, maxRenderedRobots: 2 };
    const result = layout(
      [room('a', 0), room('b', 1)],
      [
        robot('000001', 'a', 1, { desk: 0 }),
        robot('000002', 'a', 3, { desk: 1 }),
        robot('000003', 'b', 2, { desk: 0 }),
        robot('000004', 'b', 0, { desk: 1 }),
      ],
      small,
    );
    expect(result.robots.map((r) => r.key)).toEqual(['000002', '000003']);
    expect(result.rooms.map((r) => [r.id, r.hiddenRobots])).toEqual([
      ['a', 1],
      ['b', 1],
    ]);
  });

  it('folds the quietest rooms into "Other projects" beyond the room cap (E8)', () => {
    const small = { ...limits, maxVisibleRooms: 3 };
    const result = layout(
      [room('a', 0), room('b', 1), room('c', 2), room('d', 3)],
      [
        robot('00000a', 'a', 40, { desk: 0 }),
        robot('00000b', 'b', 10, { desk: 0 }),
        robot('00000b:00000c', 'b', 11, { seat: 0 }),
        robot('00000c', 'c', 30, { desk: 0 }),
        robot('00000d', 'd', 20, { desk: 2 }),
      ],
      small,
    );
    expect(result.rooms.map((r) => [r.id, r.slot, r.folded])).toEqual([
      ['a', 0, []],
      ['other', 1, ['b', 'd']],
      ['c', 2, []],
    ]);
    expect(result.robots.filter((r) => r.room === 'other')).toEqual([
      { key: '00000b', room: 'other', spot: { kind: 'desk', index: 0, standing: false } },
      { key: '00000b:00000c', room: 'other', spot: { kind: 'seat', index: 0, standing: false } },
      { key: '00000d', room: 'other', spot: { kind: 'desk', index: 1, standing: false } },
    ]);
  });

  it('ignores robots in unknown rooms', () => {
    expect(layout([room('a', 0)], [robot('000001', 'zzz', 1, { desk: 0 })], limits).robots).toEqual(
      [],
    );
  });

  describe('properties', () => {
    const limitsArb: fc.Arbitrary<LayoutLimits> = fc.record({
      roomsPerFloor: fc.constantFrom(2, 4, 8),
      desksPerRow: fc.integer({ min: 1, max: 4 }),
      maxRowsPerRoom: fc.integer({ min: 1, max: 4 }),
      tableSeats: fc.integer({ min: 1, max: 6 }),
      roomCloseAfterSec: fc.constant(1800),
      rowRemoveAfterSec: fc.constant(600),
      maxRenderedRobots: fc.integer({ min: 1, max: 20 }),
      maxVisibleRooms: fc.integer({ min: 2, max: 10 }),
    });

    const officeArb = fc
      .uniqueArray(fc.nat(30), { minLength: 1, maxLength: 16 })
      .chain((slots) =>
        fc.tuple(
          fc.constant(slots.map((slot) => room(`room-${String(slot)}`, slot, 1 + (slot % 4)))),
          fc.uniqueArray(
            fc.record({
              n: fc.integer({ min: 0, max: 0xffffff }),
              room: fc.constantFrom(...slots),
              at: fc.nat(1000),
              place: fc.oneof(fc.record({ desk: fc.nat(15) }), fc.record({ seat: fc.nat(8) })),
            }),
            { selector: (r) => r.n, maxLength: 40 },
          ),
        ),
      )
      .map(([rooms, raw]) => ({
        rooms,
        robots: raw.map((r) =>
          robot(r.n.toString(16).padStart(6, '0'), `room-${String(r.room)}`, r.at, r.place),
        ),
      }));

    it('never overlaps rooms, never moves a drawn room and always fits the limits', () => {
      fc.assert(
        fc.property(officeArb, limitsArb, ({ rooms, robots }, lim) => {
          const result = layout(rooms, robots, lim);
          const inputSlot = new Map(rooms.map((r) => [r.id, r.slot]));

          expect(new Set(result.rooms.map((r) => r.slot)).size).toBe(result.rooms.length);
          expect(result.rooms.length).toBeLessThanOrEqual(lim.maxVisibleRooms);
          expect(result.robots.length).toBeLessThanOrEqual(lim.maxRenderedRobots);
          for (const placed of result.rooms) {
            if (placed.id !== 'other') expect(placed.slot).toBe(inputSlot.get(placed.id));
            expect(placed.rows).toBeLessThanOrEqual(lim.maxRowsPerRoom);
            expect(placed.depthRows).toBeGreaterThanOrEqual(placed.rows);
            expect(placed.floor).toBeLessThan(result.floors);
          }
          const hidden = result.rooms.reduce((sum, r) => sum + r.hiddenRobots, 0);
          expect(result.robots.length + hidden).toBe(robots.length);
          const folded = result.rooms.flatMap((r) => r.folded);
          expect(result.rooms.length - (folded.length > 0 ? 1 : 0) + folded.length).toBe(
            rooms.length,
          );
        }),
      );
    });

    it('gives facing rooms the same depth (E5)', () => {
      fc.assert(
        fc.property(officeArb, limitsArb, ({ rooms, robots }, lim) => {
          const result = layout(rooms, robots, lim);
          for (const a of result.rooms) {
            for (const b of result.rooms) {
              if (a.floor === b.floor && a.bay === b.bay) expect(a.depthRows).toBe(b.depthRows);
            }
          }
        }),
      );
    });

    it('is deterministic: input order does not matter (E7)', () => {
      fc.assert(
        fc.property(officeArb, limitsArb, ({ rooms, robots }, lim) => {
          expect(layout([...rooms].reverse(), [...robots].reverse(), lim)).toEqual(
            layout(rooms, robots, lim),
          );
        }),
      );
    });
  });
});
