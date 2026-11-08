/**
 * Fixed vocabularies and limits of the v1 contract (docs/PRD.md, "Data contracts").
 * Changing any value here is a contract change: update docs/PRD.md and add an ADR.
 */

/**
 * The 12 tool categories a robot can be working in. The set is fixed in v1.
 */
export const CATEGORIES = [
  'reading',
  'coding',
  'testing',
  'vcs',
  'terminal',
  'research',
  'delegating',
  'planning',
  'designing',
  'monitoring',
  'integration',
  'working',
] as const;

/** One of the {@link CATEGORIES}. */
export type Category = (typeof CATEGORIES)[number];

/**
 * What an ingest event reports.
 *
 * - `start`: a main session started.
 * - `thinking`: Claude is working on a prompt without a tool yet.
 * - `tool`: Claude is using a tool of category `cat`.
 * - `idle`: Claude finished its turn and waits for the owner.
 * - `end`: a main session ended.
 * - `spawn`: a subagent started.
 * - `done`: a subagent finished.
 */
export const EVENT_KINDS = ['start', 'thinking', 'tool', 'idle', 'end', 'spawn', 'done'] as const;

/** One of the {@link EVENT_KINDS}. */
export type EventKind = (typeof EVENT_KINDS)[number];

/**
 * A robot's status as visitors see it.
 *
 * - `working`: using a tool (sitting, with a tool badge).
 * - `thinking`: working without a tool (sitting).
 * - `waiting`: Claude finished its turn or the session just started; waiting for the owner (sitting).
 * - `idle`: no event for `presence.idleAfterSec` (coffee corner).
 * - `away`: no event for `presence.awayAfterSec` (still listed, dimmed). After
 *   `presence.leaveAfterSec` the robot leaves.
 */
export const ROBOT_STATUSES = ['working', 'thinking', 'waiting', 'idle', 'away'] as const;

/** One of the {@link ROBOT_STATUSES}. */
export type RobotStatus = (typeof ROBOT_STATUSES)[number];

/**
 * Office-wide states the relay can announce to visitors.
 *
 * - `open`: normal operation.
 * - `busy`: the viewer cap is reached; the visitor gets a polling view (R7, H12).
 * - `limited`: the office is paused until `until` (H11).
 */
export const OFFICE_STATES = ['open', 'busy', 'limited'] as const;

/** One of the {@link OFFICE_STATES}. */
export type OfficeState = (typeof OFFICE_STATES)[number];

/** The role of every main Claude Code session. */
export const MAIN_ROLE = 'claude';

/** The role given to subagents whose type is not in `publicAgentTypes`. */
export const FALLBACK_AGENT_TYPE = 'Helper';

/** Room id of the shared room for all private sessions. It always exists (E1). */
export const PRIVATE_ROOM_ID = 'private';

/** Room id of the room that collects the quietest rooms beyond the render cap (E8). */
export const OTHER_ROOM_ID = 'other';

/** Room ids that public projects can never take. */
export const RESERVED_ROOM_IDS: readonly string[] = [PRIVATE_ROOM_ID, OTHER_ROOM_ID];

/** Length of the salted session and agent hashes, in lowercase hex characters. */
export const HASH_LENGTH = 6;

/** Maximum length of a goal, in characters. */
export const GOAL_MAX_LENGTH = 60;

/** Maximum length of a project or room name, in characters. */
export const NAME_MAX_LENGTH = 40;

/** Maximum size of an ingest request body, in bytes (R1). */
export const INGEST_MAX_BYTES = 2048;

/** How far an event timestamp may be from relay time, in seconds (R1, R2). */
export const TIMESTAMP_WINDOW_SEC = 60;

/**
 * Colours given to public projects without a configured colour, picked by a hash
 * of the project name (E1).
 */
export const ROOM_PALETTE: readonly string[] = [
  '#6ea8fe',
  '#f2a65a',
  '#b79cf2',
  '#5cc9a7',
  '#f27a8f',
  '#e3c75a',
  '#5ab8e3',
  '#a3d16a',
];
