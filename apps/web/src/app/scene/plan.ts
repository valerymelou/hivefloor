import type { Layout, LayoutLimits, PlacedRoom, Spot } from '@hivefloor/schema';

/**
 * Building geometry in metres. The corridor runs along x from the exit (x = 0)
 * eastwards; rooms on the `left` side of the corridor sit at negative z (the back
 * of the scene), rooms on the `right` side at positive z. Each floor sits
 * `floorHeight` above the one below. These values follow the prototype.
 */
export const DIMENSIONS = {
  corridorWidth: 3.2,
  floorHeight: 4.2,
  /** Spacing of desks along a row, wide enough to walk between chair and desk. */
  deskPitch: 2.7,
  /** Spacing of desk rows into the room. */
  rowPitch: 2,
  /** Depth of the team-table zone between the corridor wall and the first desk row. */
  tableZone: 3.6,
  /** Space behind the last desk row. */
  backMargin: 0.4,
  /** Width of the aisle at the room's west end, where the door is. */
  aisle: 2.2,
  /** Space east of the last desk. */
  eastMargin: 0.4,
  /** Distance of the door from the room's west wall. */
  doorInset: 1.1,
  /** Where a robot stands just inside a door. */
  insideDepth: 0.6,
  /** Distance from a chair to the desk centre, along x. */
  deskOffset: 0.82,
  /** Where a robot stands behind its chair. */
  standBehind: 0.55,
  /** Distance of the team table from the corridor wall. */
  tableDepth: 1.9,
  /** Robots keep this far from the corridor wall when walking round the table. */
  wallStrip: 0.35,
  /** Length of a stair run along x. */
  stairRun: 5,
} as const;

/** A point in the scene, in metres. */
export interface Point {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A room placed in the building. */
export interface RoomPlan {
  readonly id: string;
  readonly slot: number;
  readonly floor: number;
  readonly bay: number;
  readonly side: 'left' | 'right';
  /** West and east walls. */
  readonly x0: number;
  readonly x1: number;
  /** The wall on the corridor and the far wall. */
  readonly zWall: number;
  readonly zBack: number;
  /** Floor height. */
  readonly y: number;
  /** Desk rows that exist, and rows the room is deep enough for. */
  readonly rows: number;
  readonly depthRows: number;
  /** -1 for the left side (negative z), +1 for the right side. */
  readonly sign: -1 | 1;
  /** The door gap in the corridor wall, and a step inside it. */
  readonly door: Point;
  readonly inside: Point;
  /** Rooms folded into this "Other projects" room (E8). */
  readonly folded: readonly string[];
  /** Robots in this room beyond the render cap (E8). */
  readonly hiddenRobots: number;
}

/** A coffee corner: the back half of the lobby on every floor. */
export interface CoffeePlan {
  readonly floor: number;
  readonly x0: number;
  readonly x1: number;
  readonly zWall: number;
  readonly zBack: number;
  readonly door: Point;
  readonly inside: Point;
}

/** A straight stair between two floors, in the front half of the lobby. */
export interface StairPlan {
  /** The lower floor. */
  readonly floor: number;
  readonly bottom: Point;
  readonly top: Point;
}

/** The whole building. */
export interface Plan {
  readonly floors: number;
  /** Bays of rooms east of the lobby, on every floor. */
  readonly bays: number;
  readonly roomWidth: number;
  /** Corridor length, from the exit to the east wall. */
  readonly length: number;
  /** How far each side of the corridor reaches, on every floor. */
  readonly backDepth: number;
  readonly frontDepth: number;
  readonly rooms: readonly RoomPlan[];
  readonly coffee: readonly CoffeePlan[];
  readonly stairs: readonly StairPlan[];
  /** Where robots enter and leave, outside the west end of the ground floor. */
  readonly exit: Point;
  readonly limits: PlanLimits;
}

/** The layout limits the plan depends on. */
export type PlanLimits = Pick<LayoutLimits, 'desksPerRow' | 'maxRowsPerRoom' | 'tableSeats'>;

/** Where a robot goes in its room, and how it gets there from the door. */
export interface SpotPlan {
  /** Points to walk through after stepping inside the door. */
  readonly approach: readonly Point[];
  /** Where it stands before sitting down, or stays when standing. */
  readonly stand: Point;
  /** Where it sits; absent for a standing spot (E5, E6 overflow). */
  readonly chair?: Point;
  /** Facing, as a rotation about y (0 faces +z). */
  readonly yaw: number;
}

const D = DIMENSIONS;

/** Depth of a room with `rows` desk rows. */
export function roomDepth(rows: number): number {
  return D.tableZone + rows * D.rowPitch + D.backMargin;
}

/** Width of every room and the lobby. */
export function roomWidth(limits: Pick<LayoutLimits, 'desksPerRow'>): number {
  return D.aisle + limits.desksPerRow * D.deskPitch + D.eastMargin;
}

/** The y of a floor. */
export function floorY(floor: number): number {
  return floor * D.floorHeight;
}

/** The z of a point `depth` metres into a side of the corridor. */
function sideZ(sign: -1 | 1, depth: number): number {
  return sign * (D.corridorWidth / 2 + depth);
}

/** The lobby's x range: bay -1, at the west end. */
function lobbyX(width: number): { x0: number; x1: number } {
  return { x0: 0, x1: width };
}

function placeRoom(room: PlacedRoom, width: number): RoomPlan {
  const sign = room.side === 'left' ? -1 : 1;
  const x0 = (room.bay + 1) * width;
  const y = floorY(room.floor);
  const doorX = x0 + D.doorInset;
  return {
    id: room.id,
    slot: room.slot,
    floor: room.floor,
    bay: room.bay,
    side: room.side,
    x0,
    x1: x0 + width,
    zWall: sideZ(sign, 0),
    zBack: sideZ(sign, roomDepth(room.depthRows)),
    y,
    rows: room.rows,
    depthRows: room.depthRows,
    sign,
    door: { x: doorX, y, z: sideZ(sign, 0) },
    inside: { x: doorX, y, z: sideZ(sign, D.insideDepth) },
    folded: room.folded,
    hiddenRobots: room.hiddenRobots,
  };
}

/**
 * Turns the layout into building geometry (W1, E3–E5). Every floor has the same
 * number of bays, so floors stack neatly; rooms facing each other share a depth
 * (from the layout's `depthRows`), so the corridor stays straight. The west end
 * of every floor is a lobby: a coffee corner on the left, stairs on the right.
 *
 * @param plan - The output of `layout` from `@hivefloor/schema`.
 * @param limits - The office's layout limits.
 * @returns The building.
 */
export function buildPlan(plan: Layout, limits: PlanLimits): Plan {
  const width = roomWidth(limits);
  const bays = Math.max(1, ...plan.rooms.map((room) => room.bay + 1));
  const rooms = plan.rooms.map((room) => placeRoom(room, width));
  const depthOf = (side: 'left' | 'right'): number =>
    Math.max(
      roomDepth(1),
      ...plan.rooms.filter((room) => room.side === side).map((room) => roomDepth(room.depthRows)),
    );
  const { x0, x1 } = lobbyX(width);
  const coffee = Array.from({ length: plan.floors }, (_, floor): CoffeePlan => {
    const y = floorY(floor);
    const doorX = (x0 + x1) / 2;
    return {
      floor,
      x0,
      x1,
      zWall: sideZ(-1, 0),
      zBack: sideZ(-1, roomDepth(1)),
      door: { x: doorX, y, z: sideZ(-1, 0) },
      inside: { x: doorX, y, z: sideZ(-1, D.insideDepth) },
    };
  });
  // Stairs alternate direction and lane, so each landing is the next run's foot.
  const stairs = Array.from({ length: plan.floors - 1 }, (_, floor): StairPlan => {
    const z = sideZ(1, floor % 2 === 0 ? 1.6 : 3.8);
    const west = x0 + 1.2;
    const east = west + D.stairRun;
    const [from, to] = floor % 2 === 0 ? [west, east] : [east, west];
    return {
      floor,
      bottom: { x: from, y: floorY(floor), z },
      top: { x: to, y: floorY(floor + 1), z },
    };
  });
  return {
    floors: plan.floors,
    bays,
    roomWidth: width,
    length: (bays + 1) * width,
    backDepth: depthOf('left'),
    frontDepth: depthOf('right'),
    rooms,
    coffee,
    stairs,
    exit: { x: -1.2, y: 0, z: 0 },
    limits,
  };
}

function at(room: RoomPlan, x: number, depth: number): Point {
  return { x, y: room.y, z: sideZ(room.sign, depth) };
}

function yawToward(from: Point, to: Point): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

function deskSpot(room: RoomPlan, index: number, limits: PlanLimits, standing: boolean): SpotPlan {
  const perRow = limits.desksPerRow;
  const doorX = room.door.x;
  if (standing) {
    // Beyond the last desk: stand in a line behind the last row (E5).
    const extra = index - perRow * limits.maxRowsPerRoom;
    const depth = D.tableZone + room.rows * D.rowPitch + 0.1;
    const x = room.x0 + D.aisle + 0.3 + (extra % (perRow * 2)) * (D.deskPitch / 2);
    const stand = at(room, x, depth);
    return {
      approach: [at(room, doorX, depth), stand],
      stand,
      yaw: room.sign === 1 ? Math.PI : 0,
    };
  }
  const row = Math.floor(index / perRow);
  const col = index % perRow;
  const walkway = D.tableZone + row * D.rowPitch;
  const depth = walkway + D.rowPitch / 2;
  const chairX = room.x0 + D.aisle + 0.3 + col * D.deskPitch;
  const standX = chairX - D.standBehind;
  const stand = at(room, standX, depth);
  return {
    approach: [at(room, doorX, walkway), at(room, standX, walkway), stand],
    stand,
    chair: at(room, chairX, depth),
    yaw: Math.PI / 2,
  };
}

/** The team table's centre and seat radius (E6). */
export function tableOf(
  room: RoomPlan,
  limits: Pick<LayoutLimits, 'desksPerRow' | 'tableSeats'>,
): { centre: Point; radius: number } {
  const x = room.x0 + D.aisle + (limits.desksPerRow * D.deskPitch) / 2;
  const radius = Math.max(0.95, (limits.tableSeats * 0.6) / (2 * Math.PI) + 0.3);
  return { centre: at(room, x, D.tableDepth), radius };
}

function seatSpot(room: RoomPlan, index: number, limits: PlanLimits, standing: boolean): SpotPlan {
  const { centre, radius } = tableOf(room, limits);
  const seats = limits.tableSeats;
  const angle = (2 * Math.PI * index) / seats + Math.PI / seats + (standing ? Math.PI / 12 : 0);
  const ring = (r: number): Point => ({
    x: centre.x + Math.cos(angle) * r,
    y: room.y,
    z: centre.z + Math.sin(angle) * r * room.sign,
  });
  const stand = ring(standing ? radius + 1.2 : radius + 0.6);
  const depthOf = (p: Point): number => Math.abs(p.z) - D.corridorWidth / 2;
  const approach: Point[] = [];
  if (depthOf(stand) > D.tableDepth) {
    // The far side of the table: walk round it, not through it.
    const side = stand.x >= centre.x ? 1 : -1;
    const x = centre.x + side * (radius + 0.9);
    approach.push(at(room, x, D.wallStrip), at(room, x, depthOf(stand)));
  } else {
    approach.push(at(room, stand.x, D.wallStrip));
  }
  approach.push(stand);
  return {
    approach,
    stand,
    ...(standing ? {} : { chair: ring(radius) }),
    yaw: yawToward(stand, centre),
  };
}

/**
 * Where a robot's desk or table seat is, how to reach it from the door, and
 * where to stand when the room is full (E5, E6).
 *
 * @param room - The robot's room.
 * @param spot - The robot's spot from the layout.
 * @param limits - The office's layout limits.
 * @returns The spot.
 */
export function spotPlan(room: RoomPlan, spot: Spot, limits: PlanLimits): SpotPlan {
  return spot.kind === 'desk'
    ? deskSpot(room, spot.index, limits, spot.standing)
    : seatSpot(room, spot.index, limits, spot.standing);
}

/**
 * The `index`-th place at a floor's coffee corner, in rows facing the counter
 * along the back wall.
 *
 * @param coffee - The coffee corner.
 * @param index - The place, from 0.
 * @returns Where to stand, how to get there from the door, and the facing.
 */
export function coffeeSpot(coffee: CoffeePlan, index: number): SpotPlan {
  const perRow = 6;
  const row = Math.floor(index / perRow) % 3;
  const x = coffee.x0 + 1.4 + (index % perRow) * 1.15;
  const depth = roomDepth(1) - 2.2 - row * 0.9;
  const stand: Point = { x, y: coffee.door.y, z: sideZ(-1, depth) };
  return {
    approach: [{ x, y: stand.y, z: sideZ(-1, D.insideDepth) }, stand],
    stand,
    yaw: Math.PI,
  };
}

/** Where a point is in the building. */
export type Zone =
  | { readonly kind: 'room'; readonly room: RoomPlan }
  | { readonly kind: 'coffee'; readonly coffee: CoffeePlan }
  | { readonly kind: 'corridor'; readonly floor: number }
  | { readonly kind: 'stairs'; readonly stair: StairPlan }
  | { readonly kind: 'outside' };

const within = (v: number, a: number, b: number): boolean =>
  v >= Math.min(a, b) - 1e-6 && v <= Math.max(a, b) + 1e-6;

/**
 * Finds the zone a point is in. Doorways belong to the corridor.
 *
 * @param plan - The building.
 * @param p - The point.
 * @returns The zone.
 */
export function zoneAt(plan: Plan, p: Point): Zone {
  const floor = Math.round(p.y / D.floorHeight);
  if (Math.abs(p.y - floorY(floor)) > 0.05) {
    const stair = plan.stairs.find((s) => within(p.y, s.bottom.y, s.top.y));
    if (stair !== undefined) return { kind: 'stairs', stair };
  }
  if (p.x < 0 || floor < 0 || floor >= plan.floors) return { kind: 'outside' };
  const room = plan.rooms.find(
    (r) =>
      r.floor === floor &&
      within(p.x, r.x0, r.x1) &&
      within(p.z, r.zWall, r.zBack) &&
      Math.abs(p.z) > D.corridorWidth / 2 + 1e-6,
  );
  if (room !== undefined) return { kind: 'room', room };
  const coffee = plan.coffee[floor];
  if (
    coffee !== undefined &&
    within(p.x, coffee.x0, coffee.x1) &&
    p.z < -D.corridorWidth / 2 - 1e-6
  ) {
    return { kind: 'coffee', coffee };
  }
  return { kind: 'corridor', floor };
}
