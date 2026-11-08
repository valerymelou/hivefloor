import { DEFAULT_LAYOUT_LIMITS as limits, layout } from '@hivefloor/schema';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { advance, laneFor, LANES, route, type Destination } from './navigation';
import {
  buildPlan,
  coffeeSpot,
  spotPlan,
  zoneAt,
  type Plan,
  type Point,
  type RoomPlan,
} from './plan';

const plan: Plan = buildPlan(
  layout(
    Array.from({ length: 10 }, (_, i) => ({ id: `r${String(i)}`, slot: i, rows: 2 })),
    [],
    limits,
  ),
  limits,
);

function room(id: string): RoomPlan {
  const found = plan.rooms.find((r) => r.id === id);
  if (found === undefined) throw new Error(id);
  return found;
}

const desk = (id: string, index: number): Destination => {
  const r = room(id);
  return {
    kind: 'room',
    room: r,
    spot: spotPlan(r, { kind: 'desk', index, standing: false }, limits),
  };
};

const coffee = (floor: number, index = 0): Destination => {
  const c = plan.coffee[floor];
  if (c === undefined) throw new Error(String(floor));
  return { kind: 'coffee', coffee: c, spot: coffeeSpot(c, index) };
};

describe('laneFor', () => {
  it('picks a stable lane from the key', () => {
    expect(laneFor('a9f3c2')).toBe(laneFor('a9f3c2'));
    expect(LANES).toContain(laneFor('a9f3c2'));
    const lanes = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(laneFor));
    expect(lanes.size).toBeGreaterThan(1);
  });
});

describe('route (W3)', () => {
  it('walks in from the exit along the lane, through the door, to the desk', () => {
    const to = desk('r2', 4);
    const path = route(plan, plan.exit, to, 0.4);
    const r2 = room('r2');
    expect(path[0]).toEqual({ x: 0.3, y: 0, z: 0.4 });
    expect(path).toContainEqual({ x: r2.door.x, y: 0, z: 0.4 });
    expect(path).toContainEqual(r2.inside);
    expect(path.at(-1)).toEqual(to.kind === 'room' ? to.spot.stand : undefined);
  });

  it('leaves by the door it came in, and walks out to the exit', () => {
    const from = desk('r1', 0);
    if (from.kind !== 'room') throw new Error('room');
    const path = route(plan, from.spot.stand, { kind: 'exit' }, 0, from.spot);
    expect(path[0]).toEqual(from.spot.stand);
    expect(path).toContainEqual(room('r1').inside);
    expect(path.at(-1)).toEqual(plan.exit);
  });

  it('stays inside when the destination is in the same room', () => {
    const from = desk('r3', 0);
    const to = desk('r3', 5);
    if (from.kind !== 'room' || to.kind !== 'room') throw new Error('room');
    const path = route(plan, from.spot.stand, to, 0, from.spot);
    expect(path).not.toContainEqual(room('r3').inside);
    expect(path.at(-1)).toEqual(to.spot.stand);
  });

  it('goes to the coffee corner on the same floor, and back', () => {
    const to = coffee(0, 2);
    const from = room('r0').inside;
    const there = route(plan, from, to, -0.4);
    expect(there).toContainEqual(plan.coffee[0]?.inside);
    expect(there.every((p) => p.y === 0)).toBe(true);
    const again = route(plan, there.at(-1) ?? from, coffee(0, 3), 0);
    expect(again).not.toContainEqual(plan.coffee[0]?.inside);
  });

  it('takes the stairs between floors, both ways', () => {
    const up = route(plan, plan.exit, desk('r9', 0), 0);
    const stair = plan.stairs[0];
    expect(up).toContainEqual(stair?.bottom);
    expect(up).toContainEqual(stair?.top);
    expect(up.indexOf(stair?.bottom ?? plan.exit)).toBeLessThan(
      up.indexOf(stair?.top ?? plan.exit),
    );
    const down = route(plan, room('r9').inside, { kind: 'exit' }, 0);
    expect(down.indexOf(stair?.top ?? plan.exit)).toBeLessThan(
      down.indexOf(stair?.bottom ?? plan.exit),
    );
    expect(down.at(-1)).toEqual(plan.exit);
  });

  it('re-plans from the middle of the stairs', () => {
    const stair = plan.stairs[0];
    if (stair === undefined) throw new Error('stair');
    const middle: Point = {
      x: (stair.bottom.x + stair.top.x) / 2,
      y: (stair.bottom.y + stair.top.y) / 2,
      z: stair.bottom.z,
    };
    expect(route(plan, middle, { kind: 'exit' }, 0)[0]).toEqual(stair.bottom);
    expect(route(plan, middle, desk('r8', 0), 0)[0]).toEqual(stair.top);
  });

  it('re-plans from anywhere in the corridor', () => {
    const path = route(plan, { x: 20, y: 0, z: 1 }, desk('r0', 0), 0.8);
    expect(path[0]).toEqual({ x: 20, y: 0, z: 0.8 });
  });

  it('always ends where it was sent, without repeated points', () => {
    const destinations = [...plan.rooms.map((r) => desk(r.id, 0)), coffee(0), coffee(1)];
    const starts: Point[] = [
      plan.exit,
      ...plan.rooms.map((r) => r.inside),
      { x: 12, y: 0, z: 0 },
      { x: 12, y: 4.2, z: 0 },
    ];
    fc.assert(
      fc.property(
        fc.constantFrom(...starts),
        fc.constantFrom(...destinations),
        fc.constantFrom(...LANES),
        (from, to, lane) => {
          const path = route(plan, from, to, lane);
          const end = to.kind === 'exit' ? plan.exit : to.spot.stand;
          expect(path.at(-1)).toEqual(end);
          path.forEach((p, i) => {
            if (i > 0) expect(p).not.toEqual(path[i - 1]);
          });
          // Each step stays on a floor or follows a stair.
          for (const p of path) {
            const zone = zoneAt(plan, p);
            expect(zone.kind === 'outside' ? p === plan.exit : true).toBe(true);
          }
        },
      ),
    );
  });
});

describe('advance', () => {
  const path: Point[] = [
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 0, z: 2 },
    { x: 1, y: 3, z: 2 },
  ];

  it('moves along the path, dropping points it passes', () => {
    const step = advance({ x: 0, y: 0, z: 0 }, path, 2);
    expect(step.position).toEqual({ x: 1, y: 0, z: 1 });
    expect(step.path).toEqual(path.slice(1));
    expect(step.yaw).toBeCloseTo(0);
  });

  it('keeps the last sideways heading when climbing straight up', () => {
    const step = advance({ x: 1, y: 0, z: 2 }, path.slice(2), 1);
    expect(step.position.y).toBeCloseTo(1);
    expect(step.yaw).toBeUndefined();
  });

  it('stops at the end, and skips points it is already on', () => {
    const step = advance({ x: 1, y: 0, z: 0 }, path, 100);
    expect(step.position).toEqual(path[2]);
    expect(step.path).toEqual([]);
    expect(advance(step.position, [], 1).position).toEqual(path[2]);
  });
});
