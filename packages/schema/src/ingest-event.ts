import { z } from 'zod';
import { MAIN_ROLE } from './constants.js';
import {
  AgentHashSchema,
  CategorySchema,
  EventKindSchema,
  GoalSchema,
  NameSchema,
  RoleSchema,
  SessionHashSchema,
  UnixSecondsSchema,
  VersionSchema,
} from './primitives.js';

/**
 * One event from the CLI to the relay (`POST /ingest`). These are the only fields
 * that ever leave the owner's machine; the object is strict, so any other key is
 * rejected.
 *
 * Rules beyond the field types:
 * - `cat` is present exactly when `kind` is `tool`.
 * - `goal` is only allowed with `project`.
 * - Main sessions (no `aid`) have role `claude`; subagents (with `aid`) never do.
 * - `spawn` and `done` are subagent events and need `aid`; `start` and `end` are
 *   main-session events and must not have it.
 */
export const IngestEventSchema = z
  .strictObject({
    v: VersionSchema,
    /** Unix seconds, rounded on the owner's machine. */
    t: UnixSecondsSchema,
    /** Per-robot counter that only goes up; the relay ignores older values (H5). */
    seq: z.int().nonnegative(),
    sid: SessionHashSchema,
    aid: AgentHashSchema.optional(),
    role: RoleSchema,
    kind: EventKindSchema,
    cat: CategorySchema.optional(),
    /** A public project's name. Absent means the Private projects room. */
    project: NameSchema.optional(),
    goal: GoalSchema.optional(),
  })
  .superRefine((event, ctx) => {
    if (event.kind === 'tool' && event.cat === undefined) {
      ctx.addIssue({ code: 'custom', path: ['cat'], message: 'A tool event needs a category' });
    }
    if (event.kind !== 'tool' && event.cat !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['cat'], message: 'Only tool events have a category' });
    }
    if (event.goal !== undefined && event.project === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['goal'],
        message: 'A goal is only sent for public projects',
      });
    }
    const isSubagent = event.aid !== undefined;
    if (isSubagent === (event.role === MAIN_ROLE)) {
      ctx.addIssue({
        code: 'custom',
        path: ['role'],
        message: isSubagent
          ? 'A subagent cannot have role "claude"'
          : 'A main session has role "claude"',
      });
    }
    if ((event.kind === 'spawn' || event.kind === 'done') && !isSubagent) {
      ctx.addIssue({ code: 'custom', path: ['aid'], message: `A ${event.kind} event needs aid` });
    }
    if ((event.kind === 'start' || event.kind === 'end') && isSubagent) {
      ctx.addIssue({ code: 'custom', path: ['aid'], message: `A ${event.kind} event has no aid` });
    }
  });

/** One ingest event. */
export type IngestEvent = z.infer<typeof IngestEventSchema>;

/** The names of every field an ingest event may carry: the privacy allowlist. */
export const INGEST_EVENT_FIELDS: readonly string[] = Object.keys(IngestEventSchema.shape);
