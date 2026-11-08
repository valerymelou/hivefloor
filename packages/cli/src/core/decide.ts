import {
  MAIN_ROLE,
  type Category,
  type EventKind,
  type IngestEventInput,
  type MachineConfig,
} from '@hivefloor/schema';
import { categorize } from './categories.js';
import { shouldSend, type LastSent } from './debounce.js';
import { buildEvent, roundTimestamp } from './event.js';
import { currentGoal, updateGoalState } from './goal.js';
import { daySalt, shortHash, subagentRole, utcDay } from './identity.js';
import { readRecord, readString, type Payload } from './payload.js';
import { resolveProject, type PathContext } from './project.js';
import type { AgentState, RobotState, SessionState } from './state.js';

/** Everything `decide` needs; it does no I/O itself. */
export interface DecideInput {
  readonly payload: Payload;
  readonly config: MachineConfig;
  readonly secret: string;
  /** Unix seconds. */
  readonly now: number;
  readonly paths: PathContext;
  readonly session?: SessionState;
  readonly agent?: AgentState;
}

/** What the hook should do. Absent fields mean "leave as is". */
export interface Decision {
  readonly event?: IngestEventInput;
  readonly session?: SessionState;
  readonly agent?: AgentState;
  /** Delete the session's files (on `end`) or this subagent's file (on `done`). */
  readonly remove?: 'session' | 'agent';
}

interface Report {
  readonly kind: EventKind;
  readonly cat?: Category;
  readonly target: 'main' | 'agent';
}

function reportFor(input: DecideInput, agentId: string | undefined): Report | undefined {
  const { payload, config } = input;
  const target = agentId === undefined ? 'main' : 'agent';
  switch (readString(payload, 'hook_event_name') ?? '') {
    case 'SessionStart':
      return { kind: 'start', target: 'main' };
    case 'UserPromptSubmit':
      return { kind: 'thinking', target: 'main' };
    case 'Stop':
      return agentId === undefined ? { kind: 'idle', target: 'main' } : undefined;
    case 'SessionEnd':
      return { kind: 'end', target: 'main' };
    case 'SubagentStart':
      return agentId === undefined ? undefined : { kind: 'spawn', target };
    case 'SubagentStop':
      // Internal agents (prompt suggestions, /btw) stop without a start: ignore them.
      return agentId === undefined || input.agent === undefined
        ? undefined
        : { kind: 'done', target };
    case 'PreToolUse': {
      const tool = readString(payload, 'tool_name');
      if (tool === undefined) return undefined;
      return {
        kind: 'tool',
        cat: categorize(tool, readRecord(payload, 'tool_input'), config.mcpCategories),
        target,
      };
    }
    default:
      return undefined;
  }
}

function lastSent(report: Report, goal: string | undefined, now: number): LastSent {
  return {
    kind: report.kind,
    at: now,
    ...(report.cat === undefined ? {} : { cat: report.cat }),
    ...(goal === undefined ? {} : { goal }),
  };
}

/**
 * Decides what one hook call does: which event to send, if any, and how the
 * local state changes. Pure: the caller reads and writes the state files and
 * spawns the sender.
 *
 * Privacy: the event is built only from the session and agent IDs (hashed), the
 * tool category, the public project name and the cleaned goal. Nothing else from
 * the payload is used.
 *
 * @param input - The payload, config, secret, clock and stored state.
 * @returns The decision.
 */
export function decide(input: DecideInput): Decision {
  const { payload, config, now } = input;
  const sessionId = readString(payload, 'session_id');
  if (sessionId === undefined) {
    return {};
  }
  const agentId = readString(payload, 'agent_id');
  const base: SessionState = input.session ?? {
    v: 1,
    seq: 0,
    saltDay: utcDay(now),
    goal: { tasks: [] },
  };
  const session: SessionState = { ...base, goal: updateGoalState(base.goal, payload) };
  const changed = JSON.stringify(session) !== JSON.stringify(input.session);
  const unchanged: Decision = changed ? { session } : {};

  const report = reportFor(input, agentId);
  if (report === undefined) {
    return unchanged;
  }
  const project = resolveProject(readString(payload, 'cwd') ?? '', config.projects, input.paths);
  const isMain = report.target === 'main';
  const robot: RobotState = isMain ? session : (input.agent ?? { seq: 0 });
  const goal = isMain && project.isPublic ? currentGoal(session.goal, config.goals) : undefined;
  if (
    !shouldSend(
      robot.last,
      { kind: report.kind, ...(report.cat ? { cat: report.cat } : {}), ...(goal ? { goal } : {}) },
      now,
    )
  ) {
    return unchanged;
  }

  const salt = daySalt(input.secret, session.saltDay);
  const event = buildEvent({
    t: roundTimestamp(now, config.timestampRoundingSec),
    seq: robot.seq,
    sid: shortHash(salt, sessionId),
    ...(isMain || agentId === undefined ? {} : { aid: shortHash(salt, agentId) }),
    role: isMain
      ? MAIN_ROLE
      : subagentRole(readString(payload, 'agent_type'), config.publicAgentTypes),
    kind: report.kind,
    ...(report.cat === undefined ? {} : { cat: report.cat }),
    ...(project.name === undefined ? {} : { project: project.name }),
    ...(goal === undefined ? {} : { goal }),
  });
  const sent = { seq: robot.seq + 1, last: lastSent(report, goal, now) };

  if (isMain) {
    return {
      event,
      session: { ...session, ...sent },
      ...(report.kind === 'end' ? { remove: 'session' as const } : {}),
    };
  }
  return {
    event,
    ...unchanged,
    agent: { v: 1, ...sent },
    ...(report.kind === 'done' ? { remove: 'agent' as const } : {}),
  };
}
