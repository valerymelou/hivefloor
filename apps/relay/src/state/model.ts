import type { Category, RobotStatus } from '@hivefloor/schema';

/** A room as the relay stores it. */
export interface RoomRecord {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly group?: string;
  readonly slot: number;
  readonly rows: number;
  /** When the room first had more desk rows than it needed (E5, H14). */
  readonly surplusSince?: number;
  /** When the room last became empty (E2). */
  readonly emptySince?: number;
}

/** A robot as the relay stores it. */
export interface RobotRecord {
  readonly key: string;
  readonly parent?: string;
  readonly role: string;
  readonly room: string;
  readonly desk?: number;
  readonly seat?: number;
  readonly goal?: string;
  readonly status: RobotStatus;
  readonly cat?: Category;
  /** When the robot entered its current status (Unix seconds). */
  readonly since: number;
  /** The highest `seq` applied (H5). */
  readonly lastSeq: number;
  /** When the relay last received an event for it (Unix seconds). */
  readonly lastEventAt: number;
}

/** A robot that left recently, so late events don't bring it back (H5). */
export interface Departed {
  readonly key: string;
  readonly seq: number;
  readonly at: number;
}

/** Today's count of tool events for one room and category (R8). */
export interface TodayRecord {
  readonly room: string;
  readonly cat: Category;
  readonly n: number;
}

/** Everything the Office Durable Object keeps. */
export interface OfficeState {
  /** The UTC day today's counts belong to (R8). */
  readonly day: string;
  readonly rooms: readonly RoomRecord[];
  readonly robots: readonly RobotRecord[];
  readonly today: readonly TodayRecord[];
  readonly departed: readonly Departed[];
}

/** How long a departed robot's last `seq` is remembered. */
export const DEPARTED_TTL_SEC = 600;
