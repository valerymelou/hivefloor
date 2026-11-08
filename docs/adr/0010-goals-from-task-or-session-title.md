# 0010. Take goals from the in-progress task, or else the session title

- Status: accepted
- Date: 2026-11-08
- Deciders: Valery Melou
- Supersedes: [0004](0004-goals-from-task-list.md)

## Context and problem statement

[ADR 0004](0004-goals-from-task-list.md) takes a public project's goal from the subject of the task Claude marks in progress. While building the hook in M2 we checked the current Claude Code docs: since v2.1.268, the task tools (`TaskCreate`, `TaskUpdate`, `TodoWrite`) are provided by default only on Opus 4.7, Sonnet 4.6, Haiku 4.5 and earlier models. On current models they are off unless the owner sets `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`. With ADR 0004 alone, most public sessions would show no goal.

Claude Code also sends the session's custom title (set with `claude --name`, `/rename` or the Agent SDK) as `session_title` in `SessionStart` and `UserPromptSubmit` payloads, and a `TaskCreated` hook carries `task_subject` directly.

## Decision drivers

- Goals should appear for most owners without extra setup.
- Free text stays opt-in, short and filtered (H2).
- The owner stays in control of what visitors read.

## Considered options

1. Task list only, as in ADR 0004, and document `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`.
2. Session title only.
3. **The in-progress task when there is one, otherwise the session title.**

## Decision outcome

Chosen option: **3**. For public projects only:

1. If the task tools are on and a task is in progress (marked by `TaskUpdate` with `status: "in_progress"`, its subject recorded from the `TaskCreated` hook or the `subject` input), or a `TodoWrite` item is in progress (its `activeForm`, else `content`), that text is the goal.
2. Otherwise the session's custom title is the goal.
3. Either text goes through the same filter: dropped entirely if it starts with `[private]` or contains a blocked word; control characters and link-like words removed; cut to 60 characters. When the in-progress task is blocked, no goal is shown: the title is not used as a fallback, because the task describes what is happening right now.

The machine config gains `goals.fromSessionTitle` (default `true`) next to `goals.fromTaskList` (default `true`), so owners can turn either source off. This is an additive, optional change to the v1 contract.

### Consequences

- Good: owners get a goal by naming their session, which is a deliberate act, and richer goals when they use the task tools.
- Good: no prompt text is ever read for the goal.
- Bad: a session title is usually set once, so the goal changes less often than a task list would.
- Field names of `TaskUpdate`'s input are not documented; the CLI reads `taskId`, then `task_id`, then `id`, and `status`. Payloads recorded with `hivefloor hook --record` will confirm them.

## More information

- Claude Code docs: hooks reference (`SessionStart`, `UserPromptSubmit`, `TaskCreated`, `TaskCompleted` inputs) and tools reference ("Task tool availability").
- PRD: CLI requirement C7 and hardening rule H2 (updated in the same pull request).
