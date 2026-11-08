import { DEFAULT_LAYOUT_LIMITS as limits, layout, type LayoutRobot } from '@hivefloor/schema';
import { describe, expect, it } from 'vitest';
import {
  buildPlan,
  coffeeSpot,
  DIMENSIONS,
  roomDepth,
  roomWidth,
  spotPlan,
  tableOf,
  zoneAt,
  type Plan,
  type RoomPlan,
} from './plan';

const rooms = (n: number, rows = 1) =>
  Array.from({ length: n }, (_, i) => ({ id: `r${String(i)}`, slot: i, rows }));

function planOf(n: number, robots: LayoutRobot[] = [], rows = 1): Plan {
  return buildPlan(layout(rooms(n, rows), robots, limits), limits);
}

function room(plan: Plan, id: string): RoomPlan {
  const found = plan.rooms.find((r) => r.id === id);
  if (found === undefined) throw new Error(id);
  return found;
}

describe('buildPlan (W1, E3–E5)', () => {
  it('puts the lobby at the west end and rooms in pairs per bay', () => {
    const plan = planOf(3);
    const width = roomWidth(limits);
    expect(plan.bays).toBe(2);
    expect(plan.length).toBe(3 * width);
    expect(room(plan, 'r0')).toMatchObject({ x0: width, side: 'left', sign: -1, floor: 0 });
    expect(room(plan, 'r1')).toMatchObject({ x0: width, side: 'right', sign: 1 });
    expect(room(plan, 'r2')).toMatchObject({ x0: 2 * width, bay: 1 });
    expect(plan.coffee).toHaveLength(1);
    expect(plan.stairs).toEqual([]);
    expect(plan.exit.x).toBeLessThan(0);
  });

  it('keeps the corridor straight: facing rooms share a depth (E5)', () => {
    const plan = buildPlan(
      layout(
        [
          { id: 'a', slot: 0, rows: 3 },
          { id: 'b', slot: 1, rows: 1 },
        ],
        [],
        limits,
      ),
      limits,
    );
    expect(Math.abs(room(plan, 'a').zBack)).toBe(Math.abs(room(plan, 'b').zBack));
    expect(Math.abs(room(plan, 'a').zBack)).toBe(DIMENSIONS.corridorWidth / 2 + roomDepth(3));
    expect(plan.backDepth).toBe(roomDepth(3));
  });

  it('stacks a new floor with stairs and a coffee corner at the ninth room (E4)', () => {
    const plan = planOf(9);
    expect(plan.floors).toBe(2);
    expect(room(plan, 'r8')).toMatchObject({ floor: 1, y: DIMENSIONS.floorHeight });
    expect(plan.coffee).toHaveLength(2);
    expect(plan.stairs).toHaveLength(1);
    expect(plan.stairs[0]?.bottom.y).toBe(0);
    expect(plan.stairs[0]?.top.y).toBe(DIMENSIONS.floorHeight);
  });

  it('alternates stair direction so each landing starts the next run', () => {
    const roomy = { ...limits, maxVisibleRooms: 64 };
    const plan = buildPlan(layout(rooms(17), [], roomy), roomy);
    expect(plan.floors).toBe(3);
    const [first, second] = plan.stairs;
    expect(first?.top.x).toBe(second?.bottom.x);
    expect(first?.top.z).not.toBe(second?.bottom.z);
  });
});

describe('spotPlan (E5, E6)', () => {
  const plan = planOf(2, [], 2);
  const left = room(plan, 'r0');
  const right = room(plan, 'r1');

  it('puts desks in rows away from the corridor, facing +x', () => {
    const first = spotPlan(left, { kind: 'desk', index: 0, standing: false }, limits);
    const fourth = spotPlan(left, { kind: 'desk', index: 3, standing: false }, limits);
    expect(first.yaw).toBe(Math.PI / 2);
    expect(first.chair?.z).toBeLessThan(left.zWall);
    expect(fourth.chair?.x).toBe(first.chair?.x);
    expect(Math.abs(fourth.chair?.z ?? 0)).toBe(
      Math.abs(first.chair?.z ?? 0) + DIMENSIONS.rowPitch,
    );
    expect(first.approach.at(-1)).toEqual(first.stand);
    expect(first.approach[0]?.x).toBe(left.door.x);
  });

  it('mirrors the right side of the corridor', () => {
    const l = spotPlan(left, { kind: 'desk', index: 1, standing: false }, limits);
    const r = spotPlan(right, { kind: 'desk', index: 1, standing: false }, limits);
    expect(r.chair?.x).toBe(l.chair?.x);
    expect(r.chair?.z).toBe(-(l.chair?.z ?? 0));
  });

  it('keeps every desk inside its room', () => {
    for (let index = 0; index < 12; index++) {
      const spot = spotPlan(left, { kind: 'desk', index, standing: false }, limits);
      const chair = spot.chair;
      expect(chair).toBeDefined();
      if (chair === undefined) continue;
      expect(chair.x + DIMENSIONS.deskOffset + 0.4).toBeLessThan(left.x1);
      expect(chair.x - DIMENSIONS.standBehind).toBeGreaterThan(left.door.x);
    }
  });

  it('seats subagents round the team table and walks round it to far seats', () => {
    const { centre, radius } = tableOf(left, limits);
    const seats = Array.from({ length: 6 }, (_, index) =>
      spotPlan(left, { kind: 'seat', index, standing: false }, limits),
    );
    for (const seat of seats) {
      const chair = seat.chair;
      expect(chair).toBeDefined();
      if (chair === undefined) continue;
      expect(Math.hypot(chair.x - centre.x, chair.z - centre.z)).toBeCloseTo(radius);
      // Facing the table.
      expect(Math.atan2(centre.x - seat.stand.x, centre.z - seat.stand.z)).toBeCloseTo(seat.yaw);
    }
    const lengths = seats.map((s) => s.approach.length);
    expect(Math.min(...lengths)).toBe(2);
    expect(Math.max(...lengths)).toBe(3);
  });

  it('has robots beyond the last desk or seat stand, without a chair', () => {
    const desk = spotPlan(left, { kind: 'desk', index: 12, standing: true }, limits);
    const seat = spotPlan(left, { kind: 'seat', index: 6, standing: true }, limits);
    expect(desk.chair).toBeUndefined();
    expect(seat.chair).toBeUndefined();
    expect(Math.abs(desk.stand.z)).toBeLessThan(Math.abs(left.zBack));
    const rightDesk = spotPlan(right, { kind: 'desk', index: 13, standing: true }, limits);
    expect(rightDesk.yaw).toBe(Math.PI);
  });
});

describe('coffeeSpot', () => {
  it('lines robots up at the counter and wraps after three rows', () => {
    const coffee = planOf(1).coffee[0];
    expect(coffee).toBeDefined();
    if (coffee === undefined) return;
    const a = coffeeSpot(coffee, 0);
    const b = coffeeSpot(coffee, 1);
    const wrapped = coffeeSpot(coffee, 18);
    expect(b.stand.x).toBeGreaterThan(a.stand.x);
    expect(wrapped.stand).toEqual(a.stand);
    expect(a.stand.x).toBeLessThan(coffee.x1);
    expect(a.yaw).toBe(Math.PI);
  });
});

describe('zoneAt', () => {
  const plan = planOf(9);
  const r0 = room(plan, 'r0');
  const r8 = room(plan, 'r8');

  it('finds rooms, coffee corners, the corridor, stairs and outside', () => {
    expect(zoneAt(plan, r0.inside)).toMatchObject({ kind: 'room', room: { id: 'r0' } });
    expect(zoneAt(plan, r8.inside)).toMatchObject({ kind: 'room', room: { id: 'r8' } });
    expect(zoneAt(plan, r0.door)).toEqual({ kind: 'corridor', floor: 0 });
    expect(zoneAt(plan, { x: 5, y: DIMENSIONS.floorHeight, z: 0 })).toEqual({
      kind: 'corridor',
      floor: 1,
    });
    expect(zoneAt(plan, plan.coffee[0]?.inside ?? r0.door)).toMatchObject({ kind: 'coffee' });
    expect(zoneAt(plan, { x: 3, y: 2, z: 3 })).toMatchObject({ kind: 'stairs' });
    expect(zoneAt(plan, plan.exit)).toEqual({ kind: 'outside' });
  });
});
