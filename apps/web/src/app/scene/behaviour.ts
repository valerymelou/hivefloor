import type { Category, PlacedRobot, Robot, Room, Spot } from '@hivefloor/schema';
import { roomName } from '../core/office-view';
import { STRINGS } from '../core/strings';
import type { Destination } from './navigation';
import { coffeeSpot, spotPlan, type Plan } from './plan';

/** What a robot does once it gets where it is going. */
export type Pose = 'sit' | 'stand' | 'coffee' | 'away';

/**
 * Maps a robot's status to what it does (W2): working robots sit at their desk or
 * the team table, thinking and waiting ones stand by it (subagents keep their
 * seat while thinking), idle ones take a coffee break, and away ones leave the
 * building until their next event (H9). Robots beyond the last desk or seat
 * stand (E5, E6).
 *
 * @param robot - The robot.
 * @param spot - Its spot from the layout.
 * @returns The pose.
 */
export function poseFor(robot: Pick<Robot, 'status'>, spot: Spot): Pose {
  switch (robot.status) {
    case 'away':
      return 'away';
    case 'idle':
      return 'coffee';
    case 'working':
      return spot.standing ? 'stand' : 'sit';
    case 'thinking':
      return spot.kind === 'seat' && !spot.standing ? 'sit' : 'stand';
    case 'waiting':
      return 'stand';
  }
}

/** Animation roles; a character set maps each to one of its clips (W13). */
export type ClipRole = 'idle' | 'walk' | 'sit' | 'wave';

/**
 * The animation to play on arrival, and the one that follows a one-off clip.
 *
 * @param pose - The pose it arrived in.
 * @param status - Its status.
 * @returns The clip, and the clip to loop afterwards.
 */
export function restClip(
  pose: Pose,
  status: Robot['status'],
): { readonly clip: ClipRole; readonly then?: ClipRole } {
  if (pose === 'sit') return { clip: 'sit' };
  if (pose === 'coffee' || status === 'waiting') return { clip: 'wave', then: 'idle' };
  return { clip: 'idle' };
}

/** Whether a robot is arriving, walking within the office, leaving or at rest. */
export type Motion = 'arriving' | 'walking' | 'leaving' | 'resting';

/** Icons the tags use. */
export type IconName = Category | 'coffee' | 'walking';

/** The pill above a robot. */
export interface Badge {
  readonly text: string;
  readonly icon?: IconName;
  /** Dashed and grey: the robot isn't working. */
  readonly quiet: boolean;
  /** Animated dots instead of an icon. */
  readonly dots: boolean;
}

/** Everything a robot's floating tag shows (W4). Plain text only. */
export interface TagContent {
  readonly badge?: Badge;
  readonly name: string;
  readonly subagent: boolean;
  /** The goal line, for main sessions in public projects. */
  readonly goal?: string;
}

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

function walkingBadge(robot: Robot, motion: Motion, pose: Pose): Badge {
  const s = STRINGS.scene;
  let text: string = s.toDesk;
  if (motion === 'arriving') text = s.arriving;
  else if (motion === 'leaving' || pose === 'away')
    text = robot.parent === undefined ? s.leaving : s.subagentLeaving;
  else if (pose === 'coffee') text = s.toCoffee;
  return { text, icon: pose === 'coffee' ? 'coffee' : 'walking', quiet: true, dots: false };
}

function restingBadge(robot: Robot): Badge | undefined {
  switch (robot.status) {
    case 'working':
      return robot.cat === undefined
        ? undefined
        : {
            text: capitalize(STRINGS.categories[robot.cat]),
            icon: robot.cat,
            quiet: false,
            dots: false,
          };
    case 'thinking':
      return { text: STRINGS.scene.thinking, quiet: false, dots: true };
    case 'waiting':
      return { text: STRINGS.scene.waiting, quiet: true, dots: false };
    case 'idle':
      return { text: STRINGS.scene.onBreak, icon: 'coffee', quiet: true, dots: false };
    case 'away':
      return undefined;
  }
}

/**
 * What a robot's tag shows (W4): a badge with the kind of work or where it is
 * heading, "Claude · Project" (or "Claude · Private project", or the subagent
 * type), and the goal for public projects while the robot is at work.
 *
 * @param robot - The robot.
 * @param rooms - The open rooms, for the project name.
 * @param motion - Whether it is walking.
 * @param pose - Its pose.
 * @returns The tag's content.
 */
export function tagContent(
  robot: Robot,
  rooms: readonly Room[],
  motion: Motion,
  pose: Pose,
): TagContent {
  const badge = motion === 'resting' ? restingBadge(robot) : walkingBadge(robot, motion, pose);
  const subagent = robot.parent !== undefined;
  const showGoal =
    !subagent &&
    motion === 'resting' &&
    robot.goal !== undefined &&
    (robot.status === 'working' || robot.status === 'thinking');
  return {
    ...(badge === undefined ? {} : { badge }),
    name: subagent
      ? STRINGS.scene.subagent(robot.role)
      : STRINGS.scene.main(roomName(robot, rooms)),
    subagent,
    ...(showGoal && robot.goal !== undefined ? { goal: robot.goal } : {}),
  };
}

/** Where a robot should be and what it should do there. */
export interface Target {
  readonly pose: Pose;
  readonly destination: Destination;
  /** Identifies the destination, to tell whether it changed. */
  readonly id: string;
  /** The desk it uses, for its monitor and desk light. */
  readonly desk?: { readonly room: string; readonly index: number };
}

/**
 * Works out where every drawn robot should be (W2, W3). Coffee places are shared
 * out by key on each floor, so every visitor sees the same arrangement.
 *
 * @param robots - All robots, from the store.
 * @param placed - The robots the layout draws, with their room and spot.
 * @param plan - The building.
 * @returns Each drawn robot's target, by key.
 */
export function targetsFor(
  robots: readonly Robot[],
  placed: readonly PlacedRobot[],
  plan: Plan,
): Map<string, Target> {
  const byKey = new Map<string, Robot>(robots.map((robot) => [robot.key, robot]));
  const rooms = new Map(plan.rooms.map((room) => [room.id, room]));
  const coffeeTaken = new Map<number, number>();
  const sorted = [...placed].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const result = new Map<string, Target>();
  for (const entry of sorted) {
    const robot = byKey.get(entry.key);
    const room = rooms.get(entry.room);
    if (robot === undefined || room === undefined) continue;
    const pose = poseFor(robot, entry.spot);
    if (pose === 'away') {
      result.set(entry.key, { pose, destination: { kind: 'exit' }, id: 'exit' });
      continue;
    }
    const coffee = plan.coffee[room.floor];
    if (pose === 'coffee' && coffee !== undefined) {
      const index = coffeeTaken.get(room.floor) ?? 0;
      coffeeTaken.set(room.floor, index + 1);
      result.set(entry.key, {
        pose,
        destination: { kind: 'coffee', coffee, spot: coffeeSpot(coffee, index) },
        id: `coffee:${String(room.floor)}:${String(index)}`,
      });
      continue;
    }
    const spot = spotPlan(room, entry.spot, plan.limits);
    // Standing places sit behind the last row, so they move when the room grows.
    const where = `${room.id}:${String(room.slot)}:${entry.spot.kind}:${String(entry.spot.index)}`;
    result.set(entry.key, {
      pose,
      destination: { kind: 'room', room, spot },
      id: entry.spot.standing ? `room:${where}:standing:${String(room.rows)}` : `room:${where}`,
      ...(entry.spot.kind === 'desk' && !entry.spot.standing
        ? { desk: { room: room.id, index: entry.spot.index } }
        : {}),
    });
  }
  return result;
}
