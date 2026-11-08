import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT_LIMITS as limits } from '../office-config.js';
import {
  lowestFree,
  nextRows,
  repackSlots,
  rowsNeeded,
  shouldCloseRoom,
  slotPosition,
} from './assign.js';

describe('lowestFree', () => {
  it('reuses the first freed place', () => {
    expect(lowestFree([])).toBe(0);
    expect(lowestFree([0, 1, 3])).toBe(2);
    expect(lowestFree([2, 1, 0])).toBe(3);
  });

  it('returns a free place with every lower place taken', () => {
    fc.assert(
      fc.property(fc.array(fc.nat(30)), (taken) => {
        const free = lowestFree(taken);
        expect(taken).not.toContain(free);
        for (let i = 0; i < free; i++) expect(taken).toContain(i);
      }),
    );
  });

  it('never moves an open room while rooms open and close (E3)', () => {
    const op = fc.record({ open: fc.boolean(), id: fc.integer({ min: 0, max: 15 }) });
    fc.assert(
      fc.property(fc.array(op, { maxLength: 200 }), (ops) => {
        const slots = new Map<number, number>();
        for (const { open, id } of ops) {
          const before = new Map(slots);
          if (open && !slots.has(id)) slots.set(id, lowestFree(slots.values()));
          if (!open) slots.delete(id);
          for (const [room, slot] of slots) {
            if (before.has(room)) expect(slot).toBe(before.get(room));
          }
          expect(new Set(slots.values()).size).toBe(slots.size);
        }
      }),
    );
  });
});

describe('slotPosition', () => {
  it('puts two rooms per bay and eight per floor (E3, E4)', () => {
    expect(slotPosition(0, limits)).toEqual({ floor: 0, bay: 0, side: 'left' });
    expect(slotPosition(1, limits)).toEqual({ floor: 0, bay: 0, side: 'right' });
    expect(slotPosition(7, limits)).toEqual({ floor: 0, bay: 3, side: 'right' });
    expect(slotPosition(8, limits)).toEqual({ floor: 1, bay: 0, side: 'left' });
  });

  it('gives distinct slots distinct positions', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.nat(200), { maxLength: 50 }),
        fc.constantFrom(2, 4, 8, 16),
        (slots, perFloor) => {
          const keys = slots.map((slot) => {
            const p = slotPosition(slot, { roomsPerFloor: perFloor });
            return `${String(p.floor)}:${String(p.bay)}:${p.side}`;
          });
          expect(new Set(keys).size).toBe(slots.length);
        },
      ),
    );
  });
});

describe('repackSlots', () => {
  it('packs from 0 with the private room first, then by id (H13)', () => {
    expect(repackSlots(['ndop-ui', 'private', 'ledgerly', 'ledgerly'])).toEqual([
      { id: 'private', slot: 0 },
      { id: 'ledgerly', slot: 1 },
      { id: 'ndop-ui', slot: 2 },
    ]);
  });

  it('works without a private room', () => {
    expect(repackSlots(['b', 'a'])).toEqual([
      { id: 'a', slot: 0 },
      { id: 'b', slot: 1 },
    ]);
  });

  it('does not depend on input order', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.stringMatching(/^[a-z]{1,6}$/), { maxLength: 20 }), (ids) => {
        expect(repackSlots([...ids].reverse())).toEqual(repackSlots(ids));
      }),
    );
  });
});

describe('rows', () => {
  it('needs one row per three desks, between 1 and 4 (E5)', () => {
    expect(rowsNeeded([], limits)).toBe(1);
    expect(rowsNeeded([0, 1, 2], limits)).toBe(1);
    expect(rowsNeeded([3], limits)).toBe(2);
    expect(rowsNeeded([11], limits)).toBe(4);
    expect(rowsNeeded([40], limits)).toBe(4);
  });

  it('grows at once and shrinks trailing rows only after the delay (E5, H14)', () => {
    expect(nextRows({ rows: 1 }, [3], 0, limits)).toEqual({ rows: 2 });
    expect(nextRows({ rows: 2 }, [0], 100, limits)).toEqual({ rows: 2, surplusSince: 100 });
    expect(nextRows({ rows: 2, surplusSince: 100 }, [0], 699, limits)).toEqual({
      rows: 2,
      surplusSince: 100,
    });
    expect(nextRows({ rows: 2, surplusSince: 100 }, [0], 700, limits)).toEqual({ rows: 1 });
    expect(nextRows({ rows: 2, surplusSince: 100 }, [4], 800, limits)).toEqual({ rows: 2 });
  });

  it('never removes a row with a seated robot (H14)', () => {
    const step = fc.record({ desks: fc.array(fc.nat(14), { maxLength: 12 }), dt: fc.nat(1200) });
    fc.assert(
      fc.property(fc.array(step, { maxLength: 60 }), (steps) => {
        let state: { rows: number; surplusSince?: number } = { rows: 1 };
        let now = 0;
        for (const { desks, dt } of steps) {
          now += dt;
          state = nextRows(state, desks, now, limits);
          expect(state.rows).toBeGreaterThanOrEqual(rowsNeeded(desks, limits));
          expect(state.rows).toBeLessThanOrEqual(limits.maxRowsPerRoom);
        }
      }),
    );
  });
});

describe('shouldCloseRoom', () => {
  it('closes an empty room after 30 minutes (E2)', () => {
    expect(shouldCloseRoom({ id: 'ledgerly', robotCount: 0, emptySince: 0 }, 1799, limits)).toBe(
      false,
    );
    expect(shouldCloseRoom({ id: 'ledgerly', robotCount: 0, emptySince: 0 }, 1800, limits)).toBe(
      true,
    );
  });

  it('never closes an occupied room, a room never emptied, or the private room', () => {
    expect(shouldCloseRoom({ id: 'ledgerly', robotCount: 1, emptySince: 0 }, 9999, limits)).toBe(
      false,
    );
    expect(shouldCloseRoom({ id: 'ledgerly', robotCount: 0 }, 9999, limits)).toBe(false);
    expect(shouldCloseRoom({ id: 'private', robotCount: 0, emptySince: 0 }, 9999, limits)).toBe(
      false,
    );
  });
});
