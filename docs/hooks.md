# Claude Code hooks

Hivefloor learns what Claude Code is doing through [hooks](https://code.claude.com/docs/en/hooks): Claude Code runs `hivefloor hook` with a JSON payload on stdin for each event. The hook turns that payload into at most one small event for your office, then exits.

> `hivefloor init` registers these hooks in `~/.claude/settings.json` (or `$CLAUDE_CONFIG_DIR/settings.json`), after backing the file up, and `hivefloor uninstall` removes them again. Neither touches any other hook or setting.

## What gets registered

Every hook is a command hook with `"async": true`, so Claude Code runs it in the background and never waits for it (H1):

```json
{
  "hooks": {
    "PreToolUse": [{ "hooks": [{ "type": "command", "command": "hivefloor hook", "async": true }] }]
  }
}
```

| Hook event         | Becomes                | Reads from the payload (locally)                                                   |
| ------------------ | ---------------------- | ---------------------------------------------------------------------------------- |
| `SessionStart`     | `start`                | `session_id`, `cwd`, `session_title`                                               |
| `UserPromptSubmit` | `thinking`             | `session_id`, `cwd`, `session_title`. **Never** `prompt`.                          |
| `PreToolUse`       | `tool` with a category | `tool_name`; `tool_input.command` for shell tools; task ids and statuses for goals |
| `Stop`             | `idle`                 | `session_id`, `cwd`                                                                |
| `SubagentStart`    | `spawn`                | `agent_id`, `agent_type`                                                           |
| `SubagentStop`     | `done`                 | `agent_id` (ignored for internal agents that never started)                        |
| `TaskCreated`      | nothing (remembered)   | `task_id`, `task_subject`                                                          |
| `TaskCompleted`    | nothing (remembered)   | `task_id`                                                                          |
| `SessionEnd`       | `end`                  | `session_id`                                                                       |

Hooks inside a subagent carry `agent_id` and `agent_type`; their events belong to the subagent's robot. Every other payload field, such as `transcript_path`, `prompt`, `last_assistant_message` or `tool_input` contents, is never read. See [privacy](privacy.md) for exactly what leaves the machine.

## What the hook guarantees

- **Exit code 0, always**, and **nothing on stdout**: Claude Code adds the stdout of `SessionStart` and `UserPromptSubmit` hooks to Claude's context. Errors are swallowed; a 2.5 s deadline stops the process whatever happens.
- **Fast:** under 50 ms at p95 for the compiled binary (19 ms measured), checked in CI. The npm package pays Node's own start-up (about 25–40 ms) on top.
- **No network in the hook itself:** it starts a detached sender process that signs the event and POSTs it with a 1.5 s timeout, and returns at once (C9).

## Tool categories

| Category      | Tools                                                                                 |
| ------------- | ------------------------------------------------------------------------------------- |
| `reading`     | `Read`, `Glob`, `Grep`, `LSP`, MCP resource tools                                     |
| `coding`      | `Edit`, `MultiEdit`, `Write`, `NotebookEdit`                                          |
| `testing`     | Shell commands that run tests (`vitest`, `jest`, `pytest`, `… test`, `test:*`, …)     |
| `vcs`         | Shell commands starting with `git`, `gh`, `glab`, `hg`, `svn` or `jj`; worktree tools |
| `terminal`    | Any other shell command (`Bash`, `PowerShell`)                                        |
| `research`    | `WebFetch`, `WebSearch`                                                               |
| `delegating`  | `Agent`, `SendMessage`, `Workflow`, `TaskStop`, …                                     |
| `planning`    | Task tools, `TodoWrite`, plan mode, `AskUserQuestion`                                 |
| `monitoring`  | `Monitor`, cron and wake-up tools; MCP servers you map to it                          |
| `designing`   | MCP servers you map to it (for example Figma)                                         |
| `integration` | Any other MCP tool (`mcp__<server>__<tool>`)                                          |
| `working`     | Everything else                                                                       |

Map MCP servers with `mcpCategories` in your [machine config](configuration.md). Commands and server names are only read on your machine.

## Sending less

- A repeat of the same kind, category and goal within 10 s is skipped (C8). Lifecycle events (`start`, `idle`, `end`, `spawn`, `done`) are always sent.
- Timestamps are rounded down to `timestampRoundingSec` (5 s by default).
- `hivefloor pause` (or `"paused": true`) stops sending entirely; `hivefloor resume` starts again.

## Local files

The hook keeps a few files in `~/.config/hivefloor/` (or `$XDG_CONFIG_HOME/hivefloor`, or `%APPDATA%\hivefloor` on Windows, or `$HIVEFLOOR_HOME`):

| File                       | What                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `config.json`, `secret`    | Your machine config and shared secret.                                                    |
| `state/<key>.json`         | Per session: next `seq`, last event sent, salt day, recent task subjects and the title.   |
| `state/<key>.<agent>.json` | Per subagent: next `seq` and last event sent. Deleted when the subagent finishes.         |
| `state/config.cache.json`  | The validated config, keyed by a hash of `config.json`.                                   |
| `debug.log`                | Only with `HIVEFLOOR_DEBUG=1`: the hook name and the sanitized event, never the payload.  |
| `recordings/*.json`        | Only with `hivefloor hook --record`: scrubbed payloads (structure kept, values replaced). |

State files are written atomically (write, then rename) and removed when the session ends. File names are hashes of the IDs.

## Recording payloads for tests

To help confirm payload shapes, change a hook's command to `hivefloor hook --record`. Each payload is saved to `recordings/` with every free-text value replaced by `<string:LENGTH>` and MCP names replaced by placeholders. Review a recording before sharing it.
