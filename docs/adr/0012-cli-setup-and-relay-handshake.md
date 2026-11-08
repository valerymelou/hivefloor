# 0012. CLI setup commands and their contract with the relay

- Status: accepted
- Date: 2026-11-08
- Deciders: Valery Melou

## Context and problem statement

M3 adds the commands owners use to connect a machine (`init`, `doctor`, `preview`, `pause`, `resume`, `uninstall`) and to deploy an office (`deploy`). Three choices affect other parts of the system: which command the hooks run, how `doctor` sends a signed test event without disturbing the office, and how `deploy` gives the relay its public config.

## Decision drivers

- Never damage someone's Claude Code settings; never remove hooks we didn't add.
- The hook command must work whatever `PATH` Claude Code runs hooks with, on macOS, Linux and Windows.
- `doctor` must test the real path (signature, schema, allowlists) without a robot appearing in a public office.
- `deploy` must work from any shell, Windows included, and keep the real `office.config.json` out of git (H16).

## Decision outcome

**Settings.** `init` adds one async command hook per event to `~/.claude/settings.json` (or `$CLAUDE_CONFIG_DIR/settings.json`) in its own matcher group, and recognises its own hooks by a command word containing `hivefloor` followed by `hook`. It replaces an outdated Hivefloor hook instead of adding a second one, leaves every other hook and setting untouched, copies the file to `settings.json.hivefloor-backup-<time>` before any change (never overwriting an earlier backup) and refuses to touch a file that isn't a JSON object. Running `init` again with the same answers writes nothing. `uninstall` removes only Hivefloor hooks, plus the groups and events they leave empty.

**Hook command.** Absolute paths: a compiled binary registers itself; a global npm install registers `<node> <script> hook`; a run through `npx` registers `npx --yes hivefloor@<version> hook` with a warning, because npx is slow to start. `--command` overrides it.

**Dry run.** `doctor` signs a real `start` event for the current folder and sends it with the header `X-Office-Dry-Run: 1`. The relay verifies it exactly like any event (size, timestamp, signature, replay, schema, allowlists) and answers with the same status codes, but changes no state, sends nothing to visitors and doesn't count it. The relay implements this in M4.

**Office config for the relay.** `deploy` validates `office.config.json` with `OfficeConfigSchema`, applies defaults and passes the result to Wrangler as the `OFFICE_CONFIG` variable (`wrangler deploy --var OFFICE_CONFIG:<json>`), at most 5 KB. It runs Wrangler's JavaScript entry with Node directly, so no shell is involved. The relay reads `OFFICE_CONFIG` in M4.

**Offline name check.** `doctor` saves the relay's `/api/config` response locally, and `preview` warns when an event names a project that response didn't list (H4).

### Consequences

- Good: setup is repeatable and reversible, and every change to settings has a backup.
- Good: `doctor` exercises the full ingest path safely.
- Bad: the relay must honour the dry-run header; until M4 ships, `doctor` reports the relay as unreachable or missing.
- Bad: changing the office config means redeploying, as ADR 0006 already accepted.

## More information

- PRD: CLI requirements C1, C10–C13; hardening rules H4, H8 and H16; Data contracts (headers).
- Code: `packages/cli/src/commands/`, `packages/cli/src/core/settings.ts`.
