import { OTHER_ROOM_ID } from '../constants.js';
import type { LayoutLimits } from '../office-config.js';
import { compareText } from '../text.js';
import { rowsNeeded, slotPosition, type SlotPosition } from './assign.js';

/** A room as the layout needs it. */
export interface LayoutRoom {
  readonly id: string;
  readonly slot: number;
  readonly rows: number;
  /** Accepted and passed through; not acted on in v1 (E1). */
  readonly group?: string;
}

/** A main session's desk or a subagent's seat at the team table. */
export type Place =
  | { readonly desk: number; readonly seat?: undefined }
  | { readonly seat: number; readonly desk?: undefined };

/** A robot as the layout needs it. */
export type LayoutRobot = Place & {
  readonly key: string;
  readonly room: string;
  /** Unix seconds of the robot's last event; drives the render caps (E8). */
  readonly lastActiveAt: number;
};

/** Where a robot is drawn. */
export interface Spot {
  readonly kind: 'desk' | 'seat';
  readonly index: number;
  /** `true` beyond the last desk or table seat: the robot stands nearby (E5, E6). */
  readonly standing: boolean;
}

/** A drawn room and its place in the building. */
export interface PlacedRoom extends SlotPosition {
  readonly id: string;
  readonly slot: number;
  readonly rows: number;
  /** Rows of the deeper room in the same bay; both rooms use it so the corridor stays straight (E5). */
  readonly depthRows: number;
  readonly group?: string;
  /** Ids of the rooms folded into this one; only the "Other projects" room has any (E8). */
  readonly folded: readonly string[];
  /** Robots in this room that are not animated because of the robot cap: the "+N" sign (E8). */
  readonly hiddenRobots: number;
}

/** A drawn robot. */
export interface PlacedRobot {
  readonly key: string;
  /** The room it is drawn in: its own, or `other` when its room is folded. */
  readonly room: string;
  readonly spot: Spot;
}

/** The building as every visitor draws it. */
export interface Layout {
  readonly floors: number;
  readonly rooms: readonly PlacedRoom[];
  readonly robots: readonly PlacedRobot[];
}

type Limits = Pick<
  LayoutLimits,
  | 'roomsPerFloor'
  | 'desksPerRow'
  | 'maxRowsPerRoom'
  | 'tableSeats'
  | 'maxRenderedRobots'
  | 'maxVisibleRooms'
>;

const byKey = (a: { key: string }, b: { key: string }): number => compareText(a.key, b.key);
const bySlot = (a: { slot: number }, b: { slot: number }): number => a.slot - b.slot;

/** The most recent activity among a room's robots, or `-Infinity` for an empty room. */
function activityOf(roomId: string, robots: readonly LayoutRobot[]): number {
  return Math.max(-Infinity, ...robots.filter((r) => r.room === roomId).map((r) => r.lastActiveAt));
}

/**
 * Splits rooms into drawn and folded: beyond `maxVisibleRooms`, the quietest rooms
 * fold into one "Other projects" room, which takes one of the drawn places (E8).
 */
function chooseDrawnRooms(
  rooms: readonly LayoutRoom[],
  robots: readonly LayoutRobot[],
  limits: Limits,
): { drawn: LayoutRoom[]; folded: LayoutRoom[] } {
  if (rooms.length <= limits.maxVisibleRooms) {
    return { drawn: [...rooms], folded: [] };
  }
  const ranked = rooms
    .map((room) => ({ room, activity: activityOf(room.id, robots) }))
    .sort((a, b) => b.activity - a.activity || bySlot(a.room, b.room))
    .map(({ room }) => room);
  const keep = limits.maxVisibleRooms - 1;
  return { drawn: ranked.slice(0, keep), folded: ranked.slice(keep).sort(bySlot) };
}

/**
 * Moves the robots of folded rooms into the "Other projects" room: rooms in slot
 * order, robots by key; main sessions take desks and subagents take seats.
 */
function moveToOtherRoom(
  folded: readonly LayoutRoom[],
  robots: readonly LayoutRobot[],
): LayoutRobot[] {
  let desk = 0;
  let seat = 0;
  return folded.flatMap((room) =>
    robots
      .filter((robot) => robot.room === room.id)
      .sort(byKey)
      .map((robot): LayoutRobot => {
        const base = { key: robot.key, room: OTHER_ROOM_ID, lastActiveAt: robot.lastActiveAt };
        return robot.seat === undefined ? { ...base, desk: desk++ } : { ...base, seat: seat++ };
      }),
  );
}

function spotFor(robot: LayoutRobot, limits: Limits): Spot {
  if (robot.seat === undefined) {
    const capacity = limits.desksPerRow * limits.maxRowsPerRoom;
    return { kind: 'desk', index: robot.desk, standing: robot.desk >= capacity };
  }
  return { kind: 'seat', index: robot.seat, standing: robot.seat >= limits.tableSeats };
}

/**
 * Lays out the office: which rooms are drawn and where, which robots are animated
 * and at which spot. It is pure and deterministic, so every visitor (and the relay)
 * computes the same building from the same state (E7). It never moves a drawn room:
 * each keeps the slot the relay gave it.
 *
 * @param rooms - Open rooms with their slots and rows, as assigned by the relay.
 * @param occupancy - Robots with their rooms, desks or seats and last activity.
 * @param limits - The office's layout limits.
 * @returns The building to draw.
 */
export function layout(
  rooms: readonly LayoutRoom[],
  occupancy: readonly LayoutRobot[],
  limits: Limits,
): Layout {
  const roomIds = new Set(rooms.map((room) => room.id));
  const robots = occupancy.filter((robot) => roomIds.has(robot.room));
  const { drawn, folded } = chooseDrawnRooms(rooms, robots, limits);

  const foldedIds = new Set(folded.map((room) => room.id));
  const otherRobots = moveToOtherRoom(folded, robots);
  const placedRobots = [...robots.filter((robot) => !foldedIds.has(robot.room)), ...otherRobots];

  const allRooms = drawn.map((room) => ({ ...room, folded: [] as string[] }));
  const [firstFolded] = folded;
  if (firstFolded !== undefined) {
    const mainCount = otherRobots.filter((robot) => robot.seat === undefined).length;
    allRooms.push({
      id: OTHER_ROOM_ID,
      slot: firstFolded.slot,
      rows: rowsNeeded([mainCount - 1], limits),
      folded: folded.map((room) => room.id).sort(compareText),
    });
  }

  // Robot cap: the most recently active robots are animated, the rest are "+N".
  const ranked = [...placedRobots].sort((a, b) => b.lastActiveAt - a.lastActiveAt || byKey(a, b));
  const animated = ranked.slice(0, limits.maxRenderedRobots);
  const hidden = ranked.slice(limits.maxRenderedRobots);

  const positioned = allRooms.map((room) => ({
    room,
    rows: Math.min(room.rows, limits.maxRowsPerRoom),
    position: slotPosition(room.slot, limits),
  }));

  const placedRooms = positioned
    .map(({ room, rows, position }): PlacedRoom => {
      const facing = positioned.filter(
        (p) => p.position.floor === position.floor && p.position.bay === position.bay,
      );
      return {
        id: room.id,
        slot: room.slot,
        ...position,
        rows,
        depthRows: Math.max(...facing.map((p) => p.rows)),
        ...(room.group === undefined ? {} : { group: room.group }),
        folded: room.folded,
        hiddenRobots: hidden.filter((robot) => robot.room === room.id).length,
      };
    })
    .sort(bySlot);

  return {
    floors: Math.max(1, ...placedRooms.map((room) => room.floor + 1)),
    rooms: placedRooms,
    robots: animated
      .map((robot) => ({ key: robot.key, room: robot.room, spot: spotFor(robot, limits) }))
      .sort(byKey),
  };
}
