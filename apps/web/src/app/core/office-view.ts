import {
  PRIVATE_ROOM_ID,
  type Robot,
  type Room,
  type TodayCount,
  type ViewerMessage,
} from '@hivefloor/schema';
import { STRINGS } from './strings';

/** What the overlay shows: the office as the relay last described it. */
export interface OfficeView {
  /** Relay time of the last snapshot, in Unix seconds. */
  readonly at: number;
  readonly rooms: readonly Room[];
  readonly robots: readonly Robot[];
  readonly today: readonly TodayCount[];
}

/** A robot that arrived, changed or left, for the activity feed. */
export interface RobotChange {
  readonly before?: Robot;
  readonly after?: Robot;
}

/** The empty office shown before the first snapshot. */
export const EMPTY_OFFICE: OfficeView = { at: 0, rooms: [], robots: [], today: [] };

function upsert<T>(items: readonly T[], item: T, same: (a: T) => boolean): T[] {
  return items.some(same) ? items.map((a) => (same(a) ? item : a)) : [...items, item];
}

/**
 * Applies one relay message to the view (R4). Pure: the store and the tests use it.
 *
 * @param view - The current view.
 * @param message - A validated viewer message.
 * @returns The new view and the robot changes it caused.
 */
export function applyMessage(
  view: OfficeView,
  message: ViewerMessage,
): { view: OfficeView; changes: readonly RobotChange[] } {
  switch (message.type) {
    case 'snapshot':
      return {
        view: {
          at: message.at,
          rooms: message.rooms,
          robots: message.robots,
          today: message.today,
        },
        changes: [],
      };
    case 'room':
      return {
        view: { ...view, rooms: upsert(view.rooms, message.room, (r) => r.id === message.room.id) },
        changes: [],
      };
    case 'roomClosed':
      return {
        view: { ...view, rooms: view.rooms.filter((r) => r.id !== message.id) },
        changes: [],
      };
    case 'delta': {
      const before = view.robots.find((r) => r.key === message.robot.key);
      const robots = upsert(view.robots, message.robot, (r) => r.key === message.robot.key);
      return {
        view: { ...view, robots },
        changes: [
          before === undefined ? { after: message.robot } : { before, after: message.robot },
        ],
      };
    }
    case 'leave': {
      const before = view.robots.find((r) => r.key === message.key);
      const robots = view.robots.filter((r) => r.key !== message.key);
      return { view: { ...view, robots }, changes: before === undefined ? [] : [{ before }] };
    }
    case 'today': {
      const { room, cat } = message.count;
      return {
        view: {
          ...view,
          today: upsert(view.today, message.count, (c) => c.room === room && c.cat === cat),
        },
        changes: [],
      };
    }
    case 'status':
      return { view, changes: [] };
  }
}

/**
 * A robot's display name: "Claude" for main sessions, its type for subagents.
 *
 * @param robot - The robot.
 * @returns The name.
 */
export function robotName(robot: Robot): string {
  return robot.role === 'claude' ? STRINGS.claude : robot.role;
}

/**
 * The name of the room a robot is in, as visitors may see it.
 *
 * @param robot - The robot.
 * @param rooms - The open rooms.
 * @returns The room's name, or "Private project".
 */
export function roomName(robot: Robot, rooms: readonly Room[]): string {
  if (robot.room === PRIVATE_ROOM_ID) return STRINGS.privateProject;
  return rooms.find((room) => room.id === robot.room)?.name ?? robot.room;
}

/**
 * What a robot is doing, in words.
 *
 * @param robot - The robot.
 * @returns For example "running tests" or "on a coffee break".
 */
export function activity(robot: Robot): string {
  return robot.status === 'working' && robot.cat !== undefined
    ? STRINGS.categories[robot.cat]
    : STRINGS.statuses[robot.status];
}
