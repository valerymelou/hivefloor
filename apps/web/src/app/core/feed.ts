import type { Room } from '@hivefloor/schema';
import { activity, robotName, roomName, type RobotChange } from './office-view';
import { STRINGS } from './strings';

/** One line of the activity feed. All parts are rendered as text, never HTML (W4). */
export interface FeedEntry {
  readonly id: number;
  /** Unix seconds. */
  readonly at: number;
  readonly who: string;
  readonly where: string;
  readonly what: string;
}

/** How many entries the feed keeps (W5). */
export const FEED_SIZE = 20;

/**
 * Describes a robot change for the feed, or nothing when visitors wouldn't notice
 * it (for example a new goal with the same activity).
 *
 * @param change - What changed.
 * @param rooms - The open rooms, for names.
 * @param at - Unix seconds.
 * @param id - A unique id for the entry.
 * @returns The entry, or `undefined`.
 */
export function describeChange(
  change: RobotChange,
  rooms: readonly Room[],
  at: number,
  id: number,
): FeedEntry | undefined {
  const robot = change.after ?? change.before;
  if (robot === undefined) return undefined;
  const base = { id, at, who: robotName(robot), where: roomName(robot, rooms) };
  if (change.before === undefined) return { ...base, what: STRINGS.feed.arrived };
  if (change.after === undefined) return { ...base, what: STRINGS.feed.left };
  const before = activity(change.before);
  const after = activity(change.after);
  if (before === after) return undefined;
  const what =
    change.after.status === 'working' ? STRINGS.feed.started(after) : STRINGS.feed.now(after);
  return { ...base, what };
}

/**
 * Adds entries to the front of the feed, keeping the newest {@link FEED_SIZE}.
 *
 * @param feed - The current feed, newest first.
 * @param entries - New entries, oldest first.
 * @returns The new feed.
 */
export function pushFeed(feed: readonly FeedEntry[], entries: readonly FeedEntry[]): FeedEntry[] {
  return [...[...entries].reverse(), ...feed].slice(0, FEED_SIZE);
}
