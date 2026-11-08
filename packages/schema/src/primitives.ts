import { z } from 'zod';
import {
  CATEGORIES,
  EVENT_KINDS,
  GOAL_MAX_LENGTH,
  HASH_LENGTH,
  MAIN_ROLE,
  NAME_MAX_LENGTH,
  OFFICE_STATES,
  ROBOT_STATUSES,
} from './constants.js';
import { hasControlChars, looksLikeLink } from './text.js';

const hashPattern = new RegExp(`^[0-9a-f]{${String(HASH_LENGTH)}}$`);

/** The `v` field of every v1 contract. */
export const VersionSchema = z.literal(1);

/** A salted 6-character hash of a Claude Code session ID (`sid`). */
export const SessionHashSchema = z.string().regex(hashPattern).brand<'SessionHash'>();

/** A salted session hash. Never a raw session ID. */
export type SessionHash = z.infer<typeof SessionHashSchema>;

/** A salted 6-character hash of a subagent ID (`aid`). */
export const AgentHashSchema = z.string().regex(hashPattern).brand<'AgentHash'>();

/** A salted agent hash. Never a raw agent ID. */
export type AgentHash = z.infer<typeof AgentHashSchema>;

/** A robot's key: `sid` for a main session, `sid:aid` for a subagent. */
export const RobotKeySchema = z
  .string()
  .regex(new RegExp(`^[0-9a-f]{${String(HASH_LENGTH)}}(:[0-9a-f]{${String(HASH_LENGTH)}})?$`))
  .brand<'RobotKey'>();

/** A robot's key, unique across the office. */
export type RobotKey = z.infer<typeof RobotKeySchema>;

/** A room id: the slug of a project name, or `private` or `other`. */
export const RoomIdSchema = z
  .string()
  .min(1)
  .max(NAME_MAX_LENGTH)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .brand<'RoomId'>();

/** A room id. */
export type RoomId = z.infer<typeof RoomIdSchema>;

/** A colour as `#rrggbb`. */
export const ColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #rrggbb colour');

/** A display name: 1 to 40 characters, no control characters, not only spaces. */
export const NameSchema = z
  .string()
  .min(1)
  .max(NAME_MAX_LENGTH)
  .refine((value) => value.trim().length > 0, 'Must not be blank')
  .refine((value) => !hasControlChars(value), 'Must not contain control characters');

/**
 * A subagent type name such as `Explore` or `code-reviewer`: a letter, then up to
 * 39 letters, digits, `-` or `_`. `claude` is reserved for main sessions.
 */
export const AgentTypeSchema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_-]{0,39}$/, 'Expected a letter, then letters, digits, - or _')
  .refine((value) => value !== MAIN_ROLE, `"${MAIN_ROLE}" is reserved for main sessions`);

/** A robot's role: `claude` for main sessions, or a subagent type. */
export const RoleSchema = z.union([z.literal(MAIN_ROLE), AgentTypeSchema]);

/** A robot's role. */
export type Role = z.infer<typeof RoleSchema>;

/**
 * A goal: Claude's current task in a public project. At most 60 characters, with
 * no control characters and nothing that looks like a link.
 */
export const GoalSchema = z
  .string()
  .min(1)
  .max(GOAL_MAX_LENGTH)
  .refine((value) => !hasControlChars(value), 'Must not contain control characters')
  .refine((value) => !looksLikeLink(value), 'Must not contain links');

/** One of the 12 tool categories. */
export const CategorySchema = z.enum(CATEGORIES);

/** One of the event kinds. */
export const EventKindSchema = z.enum(EVENT_KINDS);

/** One of the robot statuses. */
export const RobotStatusSchema = z.enum(ROBOT_STATUSES);

/** One of the office states. */
export const OfficeStateSchema = z.enum(OFFICE_STATES);

/** A Unix timestamp in whole seconds. */
export const UnixSecondsSchema = z.int().nonnegative();
