import { z } from 'zod';
import {
  CategorySchema,
  ColorSchema,
  GoalSchema,
  NameSchema,
  OfficeStateSchema,
  RobotKeySchema,
  RobotStatusSchema,
  RoleSchema,
  RoomIdSchema,
  UnixSecondsSchema,
  VersionSchema,
} from './primitives.js';

/** A room as visitors see it. */
export const RoomSchema = z.strictObject({
  id: RoomIdSchema,
  name: NameSchema,
  color: ColorSchema,
  /** Position in the building: two rooms per bay, `roomsPerFloor` per floor (E3, E4). */
  slot: z.int().nonnegative(),
  floor: z.int().nonnegative(),
  /** Number of desk rows, from 1 to `maxRowsPerRoom` (E5). */
  rows: z.int().min(1).max(8),
  /** `false` when the room is empty and its lights are dimmed (E2). */
  lit: z.boolean(),
  group: z.string().max(40).optional(),
});

/** A room. */
export type Room = z.infer<typeof RoomSchema>;

/**
 * A robot as visitors see it. Main sessions carry a `desk`; subagents carry a
 * `parent` and a `seat` at the team table (E6).
 */
export const RobotSchema = z
  .strictObject({
    key: RobotKeySchema,
    parent: RobotKeySchema.optional(),
    role: RoleSchema,
    room: RoomIdSchema,
    desk: z.int().nonnegative().optional(),
    seat: z.int().nonnegative().optional(),
    goal: GoalSchema.optional(),
    status: RobotStatusSchema,
    cat: CategorySchema.optional(),
    /** When the robot entered its current status. */
    since: UnixSecondsSchema,
  })
  .superRefine((robot, ctx) => {
    const isSubagent = robot.parent !== undefined;
    if (isSubagent !== robot.key.includes(':')) {
      ctx.addIssue({
        code: 'custom',
        path: ['parent'],
        message: 'Only subagent keys (sid:aid) have a parent',
      });
    }
    if (isSubagent && (robot.seat === undefined || robot.desk !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['seat'],
        message: 'A subagent has a seat and no desk',
      });
    }
    if (!isSubagent && (robot.desk === undefined || robot.seat !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['desk'],
        message: 'A main session has a desk and no seat',
      });
    }
    if (robot.parent !== undefined && !robot.key.startsWith(`${robot.parent}:`)) {
      ctx.addIssue({
        code: 'custom',
        path: ['parent'],
        message: 'A subagent key starts with its parent key',
      });
    }
  });

/** A robot. */
export type Robot = z.infer<typeof RobotSchema>;

/** Today's count of events for one room and category (R8). */
export const TodayCountSchema = z.strictObject({
  room: RoomIdSchema,
  cat: CategorySchema,
  n: z.int().nonnegative(),
});

/** Today's count for one room and category. */
export type TodayCount = z.infer<typeof TodayCountSchema>;

/** The full office state, sent once on connect and served by `/api/snapshot` (R4, R6). */
export const SnapshotMessageSchema = z.strictObject({
  type: z.literal('snapshot'),
  v: VersionSchema,
  at: UnixSecondsSchema,
  rooms: z.array(RoomSchema),
  robots: z.array(RobotSchema),
  today: z.array(TodayCountSchema),
});

/** A room opened, grew or shrank a row, or changed its lights. */
export const RoomMessageSchema = z.strictObject({
  type: z.literal('room'),
  v: VersionSchema,
  room: RoomSchema,
});

/** A robot arrived or changed. */
export const DeltaMessageSchema = z.strictObject({
  type: z.literal('delta'),
  v: VersionSchema,
  robot: RobotSchema,
});

/** A robot left the office. */
export const LeaveMessageSchema = z.strictObject({
  type: z.literal('leave'),
  v: VersionSchema,
  key: RobotKeySchema,
});

/** A room closed and freed its slot (E2). */
export const RoomClosedMessageSchema = z.strictObject({
  type: z.literal('roomClosed'),
  v: VersionSchema,
  id: RoomIdSchema,
});

/** An office-wide state change, such as the viewer cap being reached. */
export const StatusMessageSchema = z.strictObject({
  type: z.literal('status'),
  v: VersionSchema,
  state: OfficeStateSchema,
  /** For `limited`: when the office opens again. */
  until: UnixSecondsSchema.optional(),
});

/** Any message the relay sends to visitors. */
export const ViewerMessageSchema = z.discriminatedUnion('type', [
  SnapshotMessageSchema,
  RoomMessageSchema,
  DeltaMessageSchema,
  LeaveMessageSchema,
  RoomClosedMessageSchema,
  StatusMessageSchema,
]);

/** Any message the relay sends to visitors. */
export type ViewerMessage = z.infer<typeof ViewerMessageSchema>;

/** The full office state. */
export type SnapshotMessage = z.infer<typeof SnapshotMessageSchema>;
