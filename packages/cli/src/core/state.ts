import { CATEGORIES, EVENT_KINDS, type Category, type EventKind } from '@hivefloor/schema';
import type { LastSent } from './debounce.js';
import type { GoalState, TaskEntry } from './goal.js';
import { isRecord } from './payload.js';

/** Per-robot sending state: the next `seq` (H5) and what was last sent (C8). */
export interface RobotState {
  readonly seq: number;
  readonly last?: LastSent;
}

/** The main session's state file: its robot, pinned salt day (H7) and goal state. */
export interface SessionState extends RobotState {
  readonly v: 1;
  /** The UTC day whose salt this session uses for its whole life (H7). */
  readonly saltDay: string;
  readonly goal: GoalState;
}

/** A subagent's state file. Its presence means a `spawn` was sent. */
export interface AgentState extends RobotState {
  readonly v: 1;
}

const isNat = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;
const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const kinds: readonly string[] = EVENT_KINDS;
const categories: readonly string[] = CATEGORIES;

function parseLast(value: unknown): LastSent | undefined {
  if (!isRecord(value) || !isNat(value['at']) || !kinds.includes(String(value['kind']))) {
    return undefined;
  }
  const cat = value['cat'];
  const goal = value['goal'];
  return {
    kind: value['kind'] as EventKind,
    at: value['at'],
    ...(typeof cat === 'string' && categories.includes(cat) ? { cat: cat as Category } : {}),
    ...(isText(goal) ? { goal } : {}),
  };
}

function parseRobot(value: Readonly<Record<string, unknown>>): RobotState | undefined {
  if (value['v'] !== 1 || !isNat(value['seq'])) {
    return undefined;
  }
  const last = parseLast(value['last']);
  return { seq: value['seq'], ...(last === undefined ? {} : { last }) };
}

function parseGoal(value: unknown): GoalState {
  if (!isRecord(value)) {
    return { tasks: [] };
  }
  const tasks: TaskEntry[] = Array.isArray(value['tasks'])
    ? value['tasks'].flatMap((task: unknown) =>
        isRecord(task) && isText(task['id']) && isText(task['subject'])
          ? [{ id: task['id'], subject: task['subject'] }]
          : [],
      )
    : [];
  const { title, activeTask, todo } = value;
  return {
    tasks,
    ...(isText(title) ? { title } : {}),
    ...(isText(activeTask) ? { activeTask } : {}),
    ...(isText(todo) ? { todo } : {}),
  };
}

/**
 * Reads a session state file's contents. Anything malformed counts as no state.
 *
 * @param value - The parsed JSON of the file.
 * @returns The state, or `undefined`.
 */
export function parseSessionState(value: unknown): SessionState | undefined {
  if (
    !isRecord(value) ||
    typeof value['saltDay'] !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value['saltDay'])
  ) {
    return undefined;
  }
  const robot = parseRobot(value);
  return robot === undefined
    ? undefined
    : { v: 1, ...robot, saltDay: value['saltDay'], goal: parseGoal(value['goal']) };
}

/**
 * Reads a subagent state file's contents. Anything malformed counts as no state.
 *
 * @param value - The parsed JSON of the file.
 * @returns The state, or `undefined`.
 */
export function parseAgentState(value: unknown): AgentState | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const robot = parseRobot(value);
  return robot === undefined ? undefined : { v: 1, ...robot };
}
