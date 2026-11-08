import {
  DIMENSIONS,
  floorY,
  zoneAt,
  type CoffeePlan,
  type Plan,
  type Point,
  type RoomPlan,
  type SpotPlan,
} from './plan';

/** Where a robot is heading. */
export type Destination =
  | { readonly kind: 'room'; readonly room: RoomPlan; readonly spot: SpotPlan }
  | { readonly kind: 'coffee'; readonly coffee: CoffeePlan; readonly spot: SpotPlan }
  | { readonly kind: 'exit' };

/** The corridor lanes robots walk in, so passing robots don't overlap. */
export const LANES = [-0.8, -0.4, 0, 0.4, 0.8] as const;

/**
 * Picks a robot's corridor lane from its key, so it is stable across reloads.
 *
 * @param key - The robot's key.
 * @returns A z offset from the corridor's centre line.
 */
export function laneFor(key: string): number {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return LANES[hash % LANES.length] ?? 0;
}

function destinationFloor(to: Destination): number {
  switch (to.kind) {
    case 'room':
      return to.room.floor;
    case 'coffee':
      return to.coffee.floor;
    case 'exit':
      return 0;
  }
}

const same = (a: Point, b: Point): boolean =>
  Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6 && Math.abs(a.z - b.z) < 1e-6;

/**
 * Plans a walk through the building (W3): out of the current room by its door,
 * along the robot's corridor lane, up or down the stairs, in by the target door,
 * then along the spot's approach. It works from any position, so a robot that
 * gets a new status mid-walk re-plans from where it stands.
 *
 * @param plan - The building.
 * @param from - Where the robot is now.
 * @param to - Where it is going.
 * @param lane - Its corridor lane (see `laneFor`).
 * @param leaving - The spot it is at, if any: it walks out the way it came in.
 * @returns The points to walk through, ending at the destination.
 */
export function route(
  plan: Plan,
  from: Point,
  to: Destination,
  lane: number,
  leaving?: SpotPlan,
): Point[] {
  const points: Point[] = leaving === undefined ? [] : [...leaving.approach].reverse();
  const start = points.at(-1) ?? from;
  const lanePoint = (floor: number, x: number): Point => ({ x, y: floorY(floor), z: lane });
  const target = destinationFloor(to);
  const zone = zoneAt(plan, start);

  if (to.kind === 'room' && zone.kind === 'room' && zone.room.id === to.room.id) {
    return dedupe([...points, ...to.spot.approach]);
  }
  if (to.kind === 'coffee' && zone.kind === 'coffee' && zone.coffee.floor === to.coffee.floor) {
    return dedupe([...points, ...to.spot.approach]);
  }

  let floor: number;
  switch (zone.kind) {
    case 'room':
      floor = zone.room.floor;
      points.push(zone.room.inside, lanePoint(floor, zone.room.door.x));
      break;
    case 'coffee':
      floor = zone.coffee.floor;
      points.push(zone.coffee.inside, lanePoint(floor, zone.coffee.door.x));
      break;
    case 'corridor':
      floor = zone.floor;
      points.push(lanePoint(floor, Math.max(0.3, start.x)));
      break;
    case 'stairs': {
      const up = target > zone.stair.floor;
      const end = up ? zone.stair.top : zone.stair.bottom;
      floor = up ? zone.stair.floor + 1 : zone.stair.floor;
      points.push(end, lanePoint(floor, end.x));
      break;
    }
    case 'outside':
      floor = Math.min(plan.floors - 1, Math.max(0, Math.round(start.y / DIMENSIONS.floorHeight)));
      points.push(lanePoint(floor, 0.3));
      break;
  }

  while (floor !== target) {
    const up = target > floor;
    const stair = plan.stairs.find((s) => s.floor === (up ? floor : floor - 1));
    if (stair === undefined) break;
    const [a, b] = up ? [stair.bottom, stair.top] : [stair.top, stair.bottom];
    points.push(lanePoint(floor, a.x), a, b);
    floor = up ? floor + 1 : floor - 1;
    points.push(lanePoint(floor, b.x));
  }

  switch (to.kind) {
    case 'room':
      points.push(lanePoint(floor, to.room.door.x), to.room.inside, ...to.spot.approach);
      break;
    case 'coffee':
      points.push(lanePoint(floor, to.coffee.door.x), to.coffee.inside, ...to.spot.approach);
      break;
    case 'exit':
      points.push(lanePoint(floor, 0.3), plan.exit);
      break;
  }
  return dedupe(points);
}

function dedupe(points: readonly Point[]): Point[] {
  return points.filter((p, i) => {
    const previous = points[i - 1];
    return previous === undefined || !same(previous, p);
  });
}

/** The result of moving along a path. */
export interface Step {
  readonly position: Point;
  /** The points still ahead. */
  readonly path: readonly Point[];
  /** The direction of travel as a rotation about y, when it moved sideways. */
  readonly yaw?: number;
}

/**
 * Moves a point `distance` metres along a path, dropping the points it passes.
 *
 * @param position - The start.
 * @param path - The points ahead.
 * @param distance - How far to move.
 * @returns The new position, what is left of the path and the heading.
 */
export function advance(position: Point, path: readonly Point[], distance: number): Step {
  let p = position;
  let budget = distance;
  let yaw: number | undefined;
  let index = 0;
  while (budget > 1e-9 && index < path.length) {
    const target = path[index];
    if (target === undefined) break;
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const dz = target.z - p.z;
    const length = Math.hypot(dx, dy, dz);
    if (length < 1e-6) {
      index++;
      continue;
    }
    if (Math.hypot(dx, dz) > 1e-6) yaw = Math.atan2(dx, dz);
    const step = Math.min(length, budget);
    p = {
      x: p.x + (dx / length) * step,
      y: p.y + (dy / length) * step,
      z: p.z + (dz / length) * step,
    };
    budget -= step;
    if (step >= length - 1e-9) {
      p = target;
      index++;
    }
  }
  const rest = path.slice(index);
  return yaw === undefined ? { position: p, path: rest } : { position: p, path: rest, yaw };
}
