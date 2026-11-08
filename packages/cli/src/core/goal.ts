import type { MachineConfig } from '@hivefloor/schema';
import { looksLikeLink } from '@hivefloor/schema';
import { isRecord, readArray, readRecord, readString, type Payload } from './payload.js';

/** Goal settings from the machine config. */
export type GoalSettings = MachineConfig['goals'];

/** A task Claude created, as recorded locally. */
export interface TaskEntry {
  readonly id: string;
  readonly subject: string;
}

/** What the CLI remembers about a session to pick its goal. Stored only locally. */
export interface GoalState {
  /** The session's custom title, from `--name` or `/rename`. */
  readonly title?: string;
  /** The most recent tasks, newest last. */
  readonly tasks: readonly TaskEntry[];
  /** The id of the task marked in progress. */
  readonly activeTask?: string;
  /** The in-progress item of a `TodoWrite` list, when the task tools are off. */
  readonly todo?: string;
}

/** How many tasks are remembered per session. */
export const MAX_TASKS = 50;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]+/g;

const ELLIPSIS = '…';

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  let result = '';
  for (const char of text) {
    if (result.length + char.length > maxLength - ELLIPSIS.length) {
      break;
    }
    result += char;
  }
  return `${result.trimEnd()}${ELLIPSIS}`;
}

/**
 * Turns a task subject or session title into a goal that may leave the machine,
 * or nothing (H2). Text starting with the private prefix or containing a blocked
 * word (case-insensitive) is dropped entirely. Otherwise control characters and
 * link-like words are removed, whitespace is collapsed and the result is cut to
 * `maxLength` characters.
 *
 * @param text - The raw subject or title.
 * @param settings - The owner's goal settings.
 * @returns The goal, or `undefined` when nothing may be sent.
 *
 * @example
 * ```ts
 * cleanGoal('Building the paywall screen', settings); // "Building the paywall screen"
 * cleanGoal('Rotate the API token', settings); // undefined (blocked word)
 * ```
 */
export function cleanGoal(text: string, settings: GoalSettings): string | undefined {
  const lower = text.trim().toLowerCase();
  if (lower.startsWith(settings.privatePrefix.toLowerCase())) {
    return undefined;
  }
  if (settings.blockWords.some((word) => lower.includes(word.toLowerCase()))) {
    return undefined;
  }
  const words = text
    .replace(CONTROL_CHARS, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !looksLikeLink(word));
  const goal = truncate(words.join(' '), settings.maxLength);
  return goal.length > 0 && !looksLikeLink(goal) ? goal : undefined;
}

function taskSubject(state: GoalState, id: string): string | undefined {
  return state.tasks.find((task) => task.id === id)?.subject;
}

/**
 * The goal to show for a session: the in-progress task (or `TodoWrite` item) when
 * there is one, otherwise the session title. A blocked task hides the goal rather
 * than falling back to the title.
 *
 * @param state - The session's goal state.
 * @param settings - The owner's goal settings.
 * @returns The cleaned goal, or `undefined`.
 */
export function currentGoal(state: GoalState, settings: GoalSettings): string | undefined {
  if (settings.fromTaskList) {
    const task = state.activeTask === undefined ? undefined : taskSubject(state, state.activeTask);
    const fromTasks = task ?? state.todo;
    if (fromTasks !== undefined) {
      return cleanGoal(fromTasks, settings);
    }
  }
  if (settings.fromSessionTitle && state.title !== undefined) {
    return cleanGoal(state.title, settings);
  }
  return undefined;
}

function withTask(state: GoalState, task: TaskEntry): GoalState {
  const others = state.tasks.filter((entry) => entry.id !== task.id);
  return { ...state, tasks: [...others, task].slice(-MAX_TASKS) };
}

function withoutActive(state: GoalState, id: string | undefined): GoalState {
  if (id === undefined || state.activeTask !== id) {
    return state;
  }
  const rest = { ...state };
  delete rest.activeTask;
  return rest;
}

function fromTaskUpdate(state: GoalState, input: Payload | undefined): GoalState {
  const id = readString(input, 'taskId') ?? readString(input, 'task_id') ?? readString(input, 'id');
  if (id === undefined) {
    return state;
  }
  const subject = readString(input, 'subject');
  const next = subject === undefined ? state : withTask(state, { id, subject });
  const status = readString(input, 'status');
  if (status === 'in_progress') {
    return { ...next, activeTask: id };
  }
  return status === 'completed' || status === 'deleted' ? withoutActive(next, id) : next;
}

function fromTodoWrite(state: GoalState, input: Payload | undefined): GoalState {
  const active = readArray(input, 'todos').find(
    (todo) => isRecord(todo) && todo['status'] === 'in_progress',
  );
  const text = isRecord(active)
    ? (readString(active, 'activeForm') ?? readString(active, 'content'))
    : undefined;
  if (text !== undefined) return { ...state, todo: text };
  const rest = { ...state };
  delete rest.todo;
  return rest;
}

/**
 * Updates the goal state from one hook payload. Reads only the fields it needs:
 * the session title, task ids, subjects and statuses.
 *
 * @param state - The session's goal state.
 * @param payload - The hook payload.
 * @returns The new goal state.
 */
export function updateGoalState(state: GoalState, payload: Payload): GoalState {
  const title = readString(payload, 'session_title');
  const titled = title === undefined ? state : { ...state, title };
  switch (readString(payload, 'hook_event_name') ?? '') {
    case 'TaskCreated': {
      const id = readString(payload, 'task_id');
      const subject = readString(payload, 'task_subject');
      return id === undefined || subject === undefined ? titled : withTask(titled, { id, subject });
    }
    case 'TaskCompleted':
      return withoutActive(titled, readString(payload, 'task_id'));
    case 'PreToolUse': {
      const tool = readString(payload, 'tool_name');
      const input = readRecord(payload, 'tool_input');
      if (tool === 'TaskUpdate') return fromTaskUpdate(titled, input);
      if (tool === 'TodoWrite') return fromTodoWrite(titled, input);
      return titled;
    }
    default:
      return titled;
  }
}
