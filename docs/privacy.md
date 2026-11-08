# Privacy

Hivefloor's promise: **the owner's machine decides what the office sees.** Every rule below is enforced in code and covered by tests as the milestones land; this page links to those tests once they exist.

## What leaves your machine

For a **private** project (any folder you haven't marked public), each event carries only:

- which robot (a salted 6-character hash, never the raw session ID),
- what kind of work (one of 12 fixed tool categories, such as `coding` or `testing`),
- when (rounded to 5 seconds by default).

All private sessions share one "Private projects" room, so not even the area of work is revealed. You can hide that room entirely.

For a project you mark **public**, events also carry the project's name and, optionally, a goal: the task Claude has in progress, or else the title you gave the session (`claude --name`, `/rename`). The goal is capped at 60 characters, has control characters and links removed, and is dropped entirely if it contains a blocked word (security, token, secret, …) or starts with `[private]`.

## What never leaves your machine

File paths, commands, prompts, file contents, tool inputs and outputs, MCP server names and private project names.

## What stays on your machine

The hook keeps small state files (the next sequence number, the last event sent, recent task subjects and the session title) in your Hivefloor folder, and deletes them when the session ends. It never stores prompts, transcripts or tool inputs. See [hooks](hooks.md#local-files) for the full list.

## What the relay keeps

The relay stores only the current office (rooms, robots with their hashed keys, roles, rooms, desks, statuses, categories and public goals), today's counts per room and category, the last sequence number of robots that left in the last 10 minutes, and the signatures of the last 60 seconds of requests (to reject replays). It never stores request bodies, and logging is turned off in `wrangler.jsonc`: nothing about a request is written to Cloudflare's logs.

## Threat model

Each threat in the [PRD](PRD.md) and the check that covers it:

| Threat                                     | Verified by                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| A new Claude Code field leaks private data | Property tests in `packages/cli/src/core/event.spec.ts` and `decide.spec.ts`                                              |
| The shared secret leaks                    | Unknown names rejected in `apps/relay/test/worker.spec.ts`; `hivefloor init --rotate`                                     |
| Script injection through goal text         | `apps/web/src/app/overlay/overlay.spec.ts`; Content Security Policy and injection in `apps/web-e2e/src/hardening.spec.ts` |
| Replayed requests                          | `apps/relay/test/worker.spec.ts`                                                                                          |
| Request floods use up the free plan        | [Rate limiting guide](self-hosting.md#protect-ingest-from-floods); viewer cap tested in `apps/relay/test`                 |
| Activity timing reveals too much           | `packages/cli/src/core/event.spec.ts`                                                                                     |
| Supply chain compromise                    | Zero CLI runtime dependencies, lockfile, Dependabot and CodeQL in CI                                                      |
| The hook breaks Claude Code                | `packages/cli/src/cli.integration.spec.ts`                                                                                |

## How it is enforced

- **Allowlist by construction.** The CLI builds each event field by field from the allowlist in `packages/schema`. It never copies or spreads a hook payload, so a new Claude Code field can't leak. A property-based test feeds hundreds of random payloads full of private text through the hook logic and checks that every event matches the schema and contains none of it (`packages/cli/src/core/decide.spec.ts`).
- **Two gates.** The relay re-validates every field against its own allowlists of roles, categories and public projects.
- **No raw identifiers.** IDs are hashed with a salt, so they can't be linked to local logs or across days.
- **No stored bodies.** The relay keeps only the current office state and today's counts, and never logs bodies or headers.
- **Text only.** Everything shown in the office is inserted as text, never as HTML, under a strict Content Security Policy.

Found a gap? Please report it privately, see [SECURITY.md](../SECURITY.md).
