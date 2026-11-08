import type { RobotInput, RoomInput, SnapshotMessageInput } from '@hivefloor/schema';
import type { OfficeState, RobotRecord, RoomRecord } from './model.js';

/**
 * A room as visitors see it.
 *
 * @param room - The stored room.
 * @param robots - Every robot, to decide whether its lights are on (E2).
 * @param roomsPerFloor - From the layout limits (E4).
 * @returns The room message payload.
 */
export function roomView(
  room: RoomRecord,
  robots: readonly RobotRecord[],
  roomsPerFloor: number,
): RoomInput {
  return {
    id: room.id,
    name: room.name,
    color: room.color,
    slot: room.slot,
    floor: Math.floor(room.slot / roomsPerFloor),
    rows: room.rows,
    lit: robots.some((robot) => robot.room === room.id),
    ...(room.group === undefined ? {} : { group: room.group }),
  };
}

/**
 * A robot as visitors see it: only the fields of the viewer contract.
 *
 * @param robot - The stored robot.
 * @returns The robot message payload.
 */
export function robotView(robot: RobotRecord): RobotInput {
  return {
    key: robot.key,
    role: robot.role,
    room: robot.room,
    status: robot.status,
    since: robot.since,
    ...(robot.parent === undefined ? {} : { parent: robot.parent }),
    ...(robot.desk === undefined ? {} : { desk: robot.desk }),
    ...(robot.seat === undefined ? {} : { seat: robot.seat }),
    ...(robot.goal === undefined ? {} : { goal: robot.goal }),
    ...(robot.cat === undefined ? {} : { cat: robot.cat }),
  };
}

/**
 * The full office for a new visitor or `/api/snapshot` (R4, R6).
 *
 * @param state - The office state.
 * @param now - Unix seconds.
 * @param roomsPerFloor - From the layout limits.
 * @returns The snapshot message.
 */
export function snapshotView(
  state: OfficeState,
  now: number,
  roomsPerFloor: number,
): SnapshotMessageInput {
  return {
    type: 'snapshot',
    v: 1,
    at: now,
    rooms: [...state.rooms]
      .sort((a, b) => a.slot - b.slot)
      .map((room) => roomView(room, state.robots, roomsPerFloor)),
    robots: state.robots.map(robotView),
    today: [...state.today],
  };
}
