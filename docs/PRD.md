# Hivefloor — PRD (open-source v1)

Nov 7, 2026 · @Valery

## Summary

Hivefloor is an open-source, self-hostable 3D office that shows a developer's Claude Code sessions live: each session is an animated robot at a desk, in a room for its project, with the kind of tool it is using right now. Subagents appear as smaller robots that walk in, work and leave. Projects the owner marks public also show their name and Claude's current task, which makes the page a "building in public" window.

It runs entirely on Cloudflare's free plan and needs no server of your own. Anyone can deploy their own office in about 10 minutes and connect it with one CLI command.

**Privacy promise:** the owner's machine decides what the office sees. Private projects send three facts per event: which robot, what kind of work, and when. They all share one "Private projects" room, so not even the area of work is revealed. File paths, commands, prompts, file contents and private project names never leave the machine. This promise is enforced in code and covered by tests.

**References**

- [Hivefloor 3D prototype](https://claude.ai/artifact/RbqnCQYxr5MNKA6H7HmiJr): the target look and behaviour, with simulated events.
- [Hivefloor — Final Architecture](https://claude.ai/artifact/GLxLgAps4nvtLnY8HFHNRy): the design this PRD builds on.

**Name:** the project is **Hivefloor**, a busy floor of agents at work. The repo is `hivefloor`, the npm CLI is `hivefloor` (so `npx hivefloor init`), and internal workspace packages use the `@hivefloor/` prefix. Both `hivefloor` and `hive-floor` were free on npm on 8 November 2026; publish `0.0.1` during M0 to claim the name.

## Goals, non-goals and success measures

**Goals for v1**

1. Show every running Claude Code session and subagent as a robot, live, within 1 s of the event.
2. Never leak private work: only allowlisted fields leave the machine, and the Worker re-checks them.
3. Let owners opt in per repo to show a public project's name and current task.
4. Cost $0 per month on Cloudflare's free plan and never slow down Claude Code.
5. Be easy to adopt: deploy your own office and connect it in under 10 minutes, with no code changes.
6. Be a codebase people want to read and contribute to: strict typing, tests, docs and decision records.

**Non-goals for v1**

- Talking to agents or assigning tasks from the office. That is a later, local-only mode.
- Multi-user offices (a team of developers sharing one office). The data model must not block it later.
- Long-term analytics. The office keeps today's counts only.
- Other agent tools (Cursor, Codex, Gemini CLI). The event schema should be tool-neutral so adapters can come later.
- Native apps. The office is a web page.

**Success measures**

| Measure                                                    | Target                                 |
| ---------------------------------------------------------- | -------------------------------------- |
| Event to robot moving on screen                            | p95 under 1 s                          |
| Hook overhead per tool call                                | p95 under 50 ms                        |
| Fields sent beyond the allowlist                           | 0, enforced by tests                   |
| Time from clone to a live office (new user)                | under 10 minutes, following the README |
| Daily requests on a heavy day (5 sessions, 1,000 visitors) | under 10% of the free plan             |
| Lighthouse accessibility score of the overlay              | 95 or higher                           |

## Users and core use cases

**Owner:** a developer who runs Claude Code and wants a public, live window on their work. They install the CLI, deploy their own office, and choose which repos are public.

**Visitor:** anyone who opens the office URL, such as followers, clients or recruiters. They watch, orbit the camera and read the feed; they can't change anything.

**Contributor:** a developer who forks the repo to fix a bug, add a character set or an adapter for another agent tool.

**Use cases**

1. The owner runs `npx hivefloor init`, deploys with one command, and sees their first robot sit down.
2. The owner opens Claude Code in a public repo; visitors see "Claude · Ledgerly" sit at a desk in the Ledgerly room with the current task "Building the paywall screen".
3. Claude delegates to an Explore subagent; a smaller robot walks in, reads, reports back and walks out.
4. The owner works on a client repo; visitors see a robot in the shared Private projects room labelled "Private project", with tool categories only.
5. The owner steps away; after 3 minutes the robot goes to the coffee corner, and after the session ends it leaves through the exit.
6. The owner embeds a small "3 agents working" badge on their personal site (post-v1, but the API must allow it).
7. A contributor runs the whole stack locally with demo events, without Claude Code or a Cloudflare account.

## Functional requirements

Three deliverables: a CLI that runs on the owner's machine, a relay on Cloudflare, and the office web app. Priorities: **Must** ships in v1, **Should** ships in v1 unless it blocks the release, **Could** is v1.1.

**CLI (`packages/cli`, published to npm as `hivefloor`)**

| ID  | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Priority |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| C1  | `hivefloor init` asks for the office URL, creates or accepts the shared secret, writes the config file, and merges its hooks into `~/.claude/settings.json`. It is idempotent, backs up the settings file first, and never removes hooks it didn't add.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Must     |
| C2  | `hivefloor hook` reads one hook payload from stdin and always exits 0, in under 50 ms at p95. It prints nothing to stdout, because Claude Code adds stdout from some events to Claude's context.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Must     |
| C3  | The sanitizer builds a new event from scratch using only the allowlisted fields. It never copies a payload object through.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Must     |
| C4  | Project resolution: match the working directory against configured paths (with `~` expanded, longest prefix wins) to get the public flag and project name. Unmatched folders are private.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Must     |
| C5  | Tool category mapping, including Bash command patterns (tests, git) and a local MCP server to category map. The command and server name are only read locally.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Must     |
| C6  | Identity: the main session becomes role `claude`. Inside a subagent, the payload's `agent_id` and `agent_type` give its role, filtered through `publicAgentTypes`; unlisted custom types become `Helper`. Session and agent IDs are sent only as salted 6-character hashes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Must     |
| C7  | Goals, in public repos only ([ADR 0010](adr/0010-goals-from-task-or-session-title.md)). When Claude Code's task tools are on (by default only on older models; `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` elsewhere), the CLI records each task's subject from the `TaskCreated` hook and, when `TaskUpdate` marks a task in progress, sends that subject as the goal (`TodoWrite`'s in-progress item as a fallback). Otherwise the goal is the session's custom title (`--name`, `/rename`). Either text passes the H2 filter and is cut to 60 characters; a blocked in-progress task hides the goal. `goals.fromTaskList` and `goals.fromSessionTitle` turn each source off. `TaskUpdate` field names are confirmed from payloads recorded with `--record`. | Must     |
| C8  | Debounce: per robot, skip a repeat of the same category within 10 s, with a heartbeat at least every 60 s while active.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Must     |
| C9  | Sending: a detached child process signs the event with HMAC-SHA256 and POSTs it with a 1.5 s timeout. Every failure is silent, with an optional debug log that is off by default.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Must     |
| C10 | `hivefloor doctor` checks the config, secret, hooks registration and endpoint, sends a signed test event, and prints an example of exactly what leaves the machine.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Must     |
| C11 | `hivefloor preview` takes a hook payload on stdin and prints the sanitized event without sending it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Should   |
| C12 | `hivefloor pause` and `resume` stop and restart sending without uninstalling.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Should   |
| C13 | `hivefloor uninstall` removes only its own hooks and leaves the config in place unless `--purge` is given.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Must     |
| C14 | Ships as a compiled binary for macOS, Linux and Windows with no Node needed (built with `bun build --compile`, [ADR 0011](adr/0011-compiled-binary-with-bun.md)), and as an npm package for Node 20 or later. On Windows, paths and the detached spawn work under PowerShell.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Should   |

**Relay (`apps/relay`, Cloudflare Worker and Durable Object)**

| ID  | Requirement                                                                                                                                                                                             | Priority |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1  | `POST /ingest` rejects bodies over 2 KB, timestamps more than 60 s off, bad signatures, schema errors and values outside the allowlists. It answers `204` on success and a bare status code on failure. | Must     |
| R2  | Replay protection: a signature seen in the last 60 s is rejected.                                                                                                                                       | Should   |
| R3  | One Durable Object holds the office state in SQLite: rooms, robots, desk and table-seat assignments, and today's counts, following the elastic office rules (E1–E9).                                    | Must     |
| R4  | `GET /live` upgrades to a WebSocket using the Hibernation API, sends one `snapshot` on connect, then a `delta` or `leave` message per change.                                                           | Must     |
| R5  | Presence alarm: idle after 3 min, away after 15 min (both configurable). Subagents whose parent session has left are removed. No alarm is scheduled while the office is empty.                          | Must     |
| R6  | `GET /api/config` returns the public office config (title, owner, timezone, public projects and their colours, layout limits). `GET /api/snapshot` returns the current state, cached for 5 s.           | Must     |
| R7  | Viewer cap (default 500). Above it, visitors get a static "busy" view that polls the snapshot every 2–5 minutes with jitter (H12).                                                                      | Should   |
| R8  | Today's counts reset at 00:00 UTC.                                                                                                                                                                      | Must     |
| R9  | `GET /api/badge.svg` returns a small "3 agents working" badge, cached for 60 s.                                                                                                                         | Could    |

**Office web app (`apps/web`)**

| ID  | Requirement                                                                                                                                                                                                                                                                                                       | Priority |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| W1  | The 3D office is built from the live room list: rooms in corridor bays and floors, a coffee corner and an exit, each room sized to its current desk rows (E1–E9).                                                                                                                                                 | Must     |
| W2  | One robot per robot record. Main sessions are full size in the room's colour; subagents are smaller and lighter. Animations map to status: Sitting, Idle, Walking, Wave.                                                                                                                                          | Must     |
| W3  | Movement along waypoints (room door, corridor lane, target door, spot). A new status mid-walk re-plans from the current position.                                                                                                                                                                                 | Must     |
| W4  | Floating tags: a small bulb with the icon for the kind of work. On hover, and for about 3 s after a change (one robot per room at a time), it opens to show the tool badge, "Claude · Project" or "Claude · Private project", and the goal line for public projects. All text is inserted as text, never as HTML. | Must     |
| W5  | Overlay: title and owner, counts, live status, feed (built from deltas, up to 20 entries), Building in public card, today's counts, privacy note.                                                                                                                                                                 | Must     |
| W6  | Connection handling: reconnect with backoff, a visible "Reconnecting" state, and an "Office closed until 01:00" state, inferred from a 429 or Cloudflare error 1027 response because the Worker can't run once the daily limit is reached (H11).                                                                  | Must     |
| W7  | Demo mode (`#demo`) runs the built-in simulator with no relay, for the README, local development and tests.                                                                                                                                                                                                       | Must     |
| W8  | Camera: drag to orbit, scroll or pinch to zoom, keyboard orbit with arrow keys, slow auto-rotate until the first interaction, angle and distance limits.                                                                                                                                                          | Should   |
| W9  | Clicking or tapping a robot opens a small card: role, project, status, time in status.                                                                                                                                                                                                                            | Should   |
| W10 | Respect `prefers-reduced-motion` (no auto-rotate, robots move instantly). Pause rendering when the tab is hidden. Low-power mode on phones turns off shadows and desk lights.                                                                                                                                     | Must     |
| W11 | A list view of all robots, as an accessible table, is always one click away. It is the default when WebGL is unavailable.                                                                                                                                                                                         | Must     |
| W12 | Phone layout: the feed collapses to two rows with a "Show more" button, and the camera uses a wider default angle.                                                                                                                                                                                                | Must     |
| W13 | Character sets are pluggable: a model file plus a map of clip names. The default is the CC0 RobotExpressive model.                                                                                                                                                                                                | Should   |

**Also required in the web app:** a configurable base path (`/` by default, `/office/` on the maintainer's site) an embed mode (`#embed`) that hides the overlay except a small live badge, and a showcase mode (`#showcase`) for the landing page: the office with its panels and no header, showing the simulator, clearly labelled, while the real office is empty ([ADR 0017](adr/0017-landing-office.md)).

**Elastic office: one room per project**

The building grows and shrinks with the work. Every rule below is computed by one pure layout function shared by the relay and the web app.

| ID  | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Priority |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| E1  | A public project gets its own room the first time one of its sessions starts, named and coloured from `office.config.json`; projects without a colour get one from a fixed palette, picked from a hash of the name. All private sessions share one "Private projects" room, which always exists. Each public project may carry an optional group (such as web or mobile); v1 stores it and passes it to the layout function but doesn't act on it, so wings or floors per group can arrive in v1.1 without a breaking change. | Must     |
| E2  | A room with no robots dims its lights. After `roomCloseAfterSec` empty (default 30 min), it closes and frees its slot.                                                                                                                                                                                                                                                                                                                                                                                                        | Must     |
| E3  | Rooms sit in pairs on either side of the corridor, one pair per bay. A new room takes the next free slot, and open rooms never move while a visitor is watching. Freed slots are reused; only the Durable Object repacks rooms, at the daily reset or when the office is empty, and it sends the new layout to every visitor (H13).                                                                                                                                                                                           | Must     |
| E4  | Up to 8 rooms per floor (4 bays). The 9th room starts a new floor stacked above, reached by a stair, and the camera eases out to frame the whole building.                                                                                                                                                                                                                                                                                                                                                                    | Must     |
| E5  | A room starts with one row of 3 desks and adds a row when every desk is taken, up to 4 rows (12 desks). An unused row is removed after 10 min. Rooms facing each other across a bay share the same depth so the corridor stays straight.                                                                                                                                                                                                                                                                                      | Must     |
| E6  | Each room has a team table with 6 seats. Subagents sit there instead of taking desks; beyond 6 they stand around it.                                                                                                                                                                                                                                                                                                                                                                                                          | Must     |
| E7  | `layout(rooms, occupancy, limits)` in `packages/schema` is pure and deterministic. The Durable Object uses it to assign desk and seat numbers, and the web app uses it to place them, so every visitor sees the same robot in the same place.                                                                                                                                                                                                                                                                                 | Must     |
| E8  | Render caps: at most 40 animated robots (configurable); beyond that, the least recently active show as a "+N" sign in their room. At most 12 open rooms are drawn; the quietest fold into an "Other projects" room. The list view always shows everyone.                                                                                                                                                                                                                                                                      | Must     |
| E9  | Desks, chairs and monitors are drawn with instanced meshes; distant robots update their animation less often; a room growing or a floor appearing animates over 600 ms, or instantly with reduced motion.                                                                                                                                                                                                                                                                                                                     | Should   |

## Privacy and security

Privacy is the product's core promise, so every rule here is enforced in code and covered by a test, not just documented.

**Rules**

- **Allowlist by construction.** The CLI builds each event field by field from the allowlist in `packages/schema`. A field that isn't in the schema can't be sent, even if Claude Code adds new payload fields later.
- **Two gates.** The Worker re-validates every field against its own allowlists for roles, categories and public projects. A compromised or buggy client can't add new names to the page.
- **Free text only where opted in.** The only free text that ever leaves the machine is the goal, and only for repos marked public. It is capped at 60 characters, has control characters and links stripped, and is rendered as text.
- **No raw identifiers.** Session and agent IDs are sent as 6-character HMAC hashes with a daily salt, so they can't be linked across days or matched to local logs.
- **No storage of request bodies.** The relay keeps only the current office state and today's counts. Worker logs must never include bodies or headers.
- **Safe hook.** The hook always exits 0, prints nothing to stdout, and times out, so it can never block or alter a Claude Code session.

**Threat model**

| Threat                                             | Mitigation                                                                                                                    | Verified by                                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| A new Claude Code payload field leaks private data | Allowlist construction; the sanitizer never spreads input objects                                                             | Property-based test: random payloads never produce keys or values outside the schema |
| The shared secret leaks                            | Worker allowlists limit fake activity to known names; `hivefloor init --rotate` plus `wrangler secret put` rotates it         | Integration test: an unknown project or role is rejected                             |
| Script injection through goal or project text      | Text-only rendering; Angular's default sanitizing, never bypassed; strict Content Security Policy via `_headers`              | Unit test with markup in the goal; CSP check in end-to-end tests                     |
| Replayed requests                                  | 60 s timestamp window and a cache of seen signatures                                                                          | Integration test                                                                     |
| Request floods use up the free plan                | 2 KB body cap, one Cloudflare rate-limiting rule on `/ingest`, viewer cap; worst case the office pauses until the daily reset | Documented in the self-hosting guide                                                 |
| Activity timing reveals too much                   | Timestamps rounded to 5 s by default, configurable up to 60 s                                                                 | Unit test                                                                            |
| Supply chain compromise                            | CLI has zero runtime dependencies; lockfile; npm publishing with provenance; Dependabot and CodeQL                            | CI                                                                                   |
| The hook breaks Claude Code                        | Exit 0 always, no stdout, 3 s hook timeout, detached sender                                                                   | Test that runs the hook with a dead endpoint and malformed input                     |

**Security headers on every page:** `Content-Security-Policy` (self only, Google Fonts if used), `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` denying camera, microphone and location, and frame-ancestors 'self' so only the office's own site can embed it.

**Disclosure:** `SECURITY.md` describes private reporting through GitHub security advisories.

## Non-functional requirements

| Area                 | Requirement                                                                                                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Latency              | Event to screen under 1 s at p95. Hook overhead under 50 ms at p95, measured by a benchmark script in CI; hooks run with async: true (H1), so this is background CPU cost, never a delay to Claude.                                       |
| Cost                 | Runs within Cloudflare's free plan: under 10,000 Worker requests and 10,000 Durable Object requests on a heavy day (5 sessions, about 2,000 events, 1,000 visitors). Static assets don't count against the limit.                         |
| Web performance      | Initial transfer under 1.5 MB compressed, including Three.js and one character model. Steady 60 fps on a 2020 laptop and at least 30 fps on a mid-range phone with 10 robots. First render of the overlay under 1.5 s on a 4G connection. |
| Durable Object       | Hibernates between events; no timers or open requests that prevent it. Alarms only while robots are present.                                                                                                                              |
| Accessibility        | Overlay meets WCAG 2.2 AA: contrast, focus states, keyboard access to every control, `aria-live` feed, a list view equivalent to the 3D scene, and `prefers-reduced-motion` respected.                                                    |
| Reliability          | If the relay is down or over its limit, Claude Code is unaffected and the page shows a clear status. Reconnects never stampede: backoff with jitter, capped at 30 s.                                                                      |
| Browsers             | Latest two versions of Chrome, Edge, Firefox and Safari, including iOS Safari.                                                                                                                                                            |
| Portability          | CLI on macOS, Linux and Windows with Node 20 or later. Relay deploys with one `wrangler deploy`.                                                                                                                                          |
| Observability        | Worker analytics only, no request bodies. `hivefloor doctor` is the main debugging tool for owners.                                                                                                                                       |
| Internationalization | All overlay copy in one strings file; English ships in v1, and French should be easy to add.                                                                                                                                              |

## Architecture

&#91;embedded content: Agent Office architecture · owner's machine, Cloudflare, visitors\]

Events flow down the page: the CLI strips everything outside the schema on the owner's machine, the Worker checks the signature and allowlists, and the Durable Object assigns desks and sends each change to every open browser. Full rationale: [Hivefloor — Final Architecture](https://claude.ai/artifact/GLxLgAps4nvtLnY8HFHNRy).

## Tech stack and monorepo layout

One TypeScript monorepo, strict everywhere, with the event contract defined once in `packages/schema` and imported by the CLI, the relay and the web app.

| Concern    | Choice                                                                                                                                                                                                                                 | Why                                                                                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language   | TypeScript, `strict` plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`                                                                                                                                                  | One language end to end; the contract is checked at compile time                                                                                                                 |
| Workspace  | Nx on pnpm workspaces, with no Nx Cloud connection by default                                                                                                                                                                          | First-class Angular support and migrations; nx affected runs only what changed, which saves CI minutes; module-boundary rules keep packages honest; contributors need no account |
| Contract   | Zod 4 schemas in `packages/schema`, with JSON Schema generated for both config files                                                                                                                                                   | Runtime validation and types from one source; editor autocomplete for config                                                                                                     |
| CLI        | Node 20+, ESM, zero runtime dependencies (`node:util` parseArgs, `node:crypto`, `node:child_process`), bundled with tsdown and also shipped as a single compiled binary, so Node isn't required (H1)                                   | Fast start for a hook that runs on every tool call; small supply-chain surface                                                                                                   |
| Relay      | Cloudflare Workers with Hono for routing, one SQLite-backed Durable Object, Wrangler                                                                                                                                                   | Free plan, WebSocket hibernation, one-command deploy                                                                                                                             |
| Web        | Angular (current stable): standalone components, signals, zoneless change detection                                                                                                                                                    | Strong structure for a long-lived open-source app; the maintainer's main framework                                                                                               |
| 3D         | Three.js with GLTFLoader, SkeletonUtils, CSS2DRenderer and OrbitControls; models optimised with gltf-transform (quantization; see ADR 0015)                                                                                            | Mature, well documented, no game engine needed                                                                                                                                   |
| Overlay UI | Ndop UI (ndop.dev), a copy-in component registry for Angular 21 and 22: npx @ndop/cli init in apps/web, components copied in as source, updated with npx @ndop/cli update and checked with npx @ndop/cli verify; requires Tailwind CSS | No heavy UI framework on a page that is mostly canvas                                                                                                                            |
| Tests      | Vitest everywhere, `@cloudflare/vitest-pool-workers` for the relay, fast-check for property tests, Playwright for end-to-end                                                                                                           | One test runner; real Workers runtime in tests                                                                                                                                   |
| Quality    | ESLint flat config with `typescript-eslint` strict type-checked rules and `angular-eslint`; Nx module-boundary rules; Prettier; commitlint with Conventional Commits                                                                   | Industry-standard style, enforced in CI                                                                                                                                          |
| Releases   | Nx Release with version plans for versions and changelogs; npm publishing with provenance                                                                                                                                              | Clear history for users and contributors                                                                                                                                         |

**Project site (`apps/site`).** Analog, Angular's meta-framework, pre-renders the landing page and the docs, rendering the Markdown files in `docs/` so they have one source. It uses Ndop UI and Tailwind CSS like the office app. On the maintainer's deployment, one Worker serves everything at hivefloor.valerymelou.com: the landing page at `/` (the office itself, full screen, with the project's name, links and credits over it), the docs at `/docs` and the full live office at `/office`. Self-hosters don't need `apps/site`; their office is served at `/`.

**Two config files, on purpose**

- `office.config.json` is public, but stays out of git (the repo ships an example; see H16): office title, owner name, timezone, public projects with their colours, the private room, allowed subagent types, presence timings, layout limits. The relay serves it at `/api/config` and builds its allowlists from it.
- `~/.config/hivefloor/config.json` lives only on the owner's machine: endpoint, secret, repo paths, which repos are public and under which name, local MCP and Bash category rules. It is never committed or uploaded.

**Repository layout**

```
hivefloor/
├─ apps/
│  ├─ relay/                 Cloudflare Worker and Durable Object (tags: scope:relay)
│  │  ├─ src/index.ts           routes (Hono)
│  │  ├─ src/office.ts          Office Durable Object
│  │  ├─ src/ingest/            signature check, validation, allowlists
│  │  ├─ src/state/             rooms, robots, desks and seats, presence, today's counts
│  │  ├─ public/_headers        security headers for the web app
│  │  ├─ project.json           Nx targets wrapping wrangler and Vitest
│  │  └─ wrangler.jsonc
│  ├─ web/                   Angular app (tags: scope:web)
│  │  ├─ src/app/core/          config, live connection, office store
│  │  ├─ src/app/scene/         Three.js: building, robots, navigation, tags
│  │  ├─ src/app/overlay/       header, feed, Building in public, counts, list view, robot card
│  │  ├─ src/app/demo/          event simulator
│  │  └─ public/models/         default character set and its licence
│  ├─ site/                  landing page and docs for hivefloor.valerymelou.com (Analog; tags: scope:site)
│  └─ web-e2e/               Playwright tests against demo mode
├─ packages/
│  ├─ schema/                Zod schemas, types, constants, layout function, JSON Schema (tags: type:shared)
│  └─ cli/                   hivefloor: init, hook, doctor, preview, pause, resume, uninstall, deploy (tags: scope:cli)
├─ docs/
│  ├─ architecture.md  privacy.md  self-hosting.md  configuration.md
│  ├─ hooks.md  character-sets.md  troubleshooting.md
│  └─ adr/                   architecture decision records
├─ .nx/version-plans/       pending release notes, one file per change
├─ .github/                 workflows, issue and PR templates, CODEOWNERS, dependabot.yml
├─ office.config.example.json
├─ README.md  CONTRIBUTING.md  CODE_OF_CONDUCT.md  SECURITY.md
├─ LICENSE  THIRD_PARTY_NOTICES.md  CLAUDE.md
└─ nx.json  package.json  pnpm-workspace.yaml  tsconfig.base.json  eslint.config.mjs
```

Module boundaries: `scope:web`, `scope:relay` and `scope:cli` may depend only on `type:shared` (the schema package), never on each other. The relay has no official Nx plugin, so its `project.json` wraps `wrangler dev`, `wrangler deploy` and Vitest with `nx:run-commands`.

## Data contracts

All contracts are versioned with a `v` field and defined as Zod schemas in `packages/schema`. Within v1 only additive, optional changes are allowed; a breaking change means `v: 2`, and the relay accepts both versions for one minor release.

**Office config (`office.config.json`, public, in the repo)**

```json
{
  "$schema": "./node_modules/@hivefloor/schema/office.schema.json",
  "v": 1,
  "title": "Hivefloor",
  "owner": "Valery Melou",
  "timezone": "Africa/Douala",
  "publicProjects": [
    { "name": "Builderswave", "color": "#6ea8fe", "group": "web" },
    { "name": "Ledgerly", "color": "#f2a65a", "group": "mobile" },
    { "name": "Ndop UI", "color": "#b79cf2", "group": "open-source" }
  ],
  "privateRoom": {
    "name": "Private projects",
    "color": "#8d94ab",
    "visible": true
  },
  "agentTypes": ["Explore", "Plan", "Helper", "code-reviewer"],
  "presence": { "idleAfterSec": 180, "awayAfterSec": 900, "leaveAfterSec": 3600 },
  "layout": {
    "roomsPerFloor": 8,
    "desksPerRow": 3,
    "maxRowsPerRoom": 4,
    "tableSeats": 6,
    "roomCloseAfterSec": 1800,
    "rowRemoveAfterSec": 600,
    "maxRenderedRobots": 40,
    "maxVisibleRooms": 12
  },
  "viewerCap": 500
}
```

The repo ships this as `office.config.example.json`. Your real copy is git-ignored and deployed with `hivefloor deploy` (H16), which validates it and passes it to the relay as the `OFFICE_CONFIG` Worker variable (at most 5 KB).

**Machine config (`~/.config/hivefloor/config.json`, private)**

```json
{
  "$schema": "https://unpkg.com/hivefloor/machine.schema.json",
  "v": 1,
  "endpoint": "https://office.example.com/ingest",
  "projects": [
    { "path": "~/code/ledgerly", "public": true, "name": "Ledgerly" },
    { "path": "~/code/builderswave", "public": true, "name": "Builderswave" }
  ],
  "publicAgentTypes": ["Explore", "Plan", "code-reviewer"],
  "goals": {
    "fromTaskList": true,
    "fromSessionTitle": true,
    "maxLength": 60,
    "blockWords": [
      "security",
      "vulnerability",
      "CVE",
      "exploit",
      "token",
      "secret",
      "password",
      "credential"
    ],
    "privatePrefix": "[private]"
  },
  "mcpCategories": { "Figma": "designing", "Sentry": "monitoring" },
  "timestampRoundingSec": 5,
  "paused": false
}
```

Any folder not listed as public, including every client repo, is private and goes to the shared Private projects room.

The secret is stored next to it in a `secret` file with mode 600, never inside the JSON.

**Ingest event (CLI to relay)**

```json
{ "v": 1, "t": 1794091200, "seq": 12, "sid": "a9f3c2", "role": "claude", "project": "Ledgerly", "goal": "Building the paywall screen", "kind": "tool", "cat": "testing" }
{ "v": 1, "t": 1794091260, "seq": 3, "sid": "7d01aa", "role": "claude", "kind": "tool", "cat": "terminal" }
```

The second event has no `project`, so it belongs to the Private projects room. The event object is strict: any field not in this table is rejected.

| Field     | Type                       | Rule                                                                               |
| --------- | -------------------------- | ---------------------------------------------------------------------------------- |
| `v`       | `1`                        | Required                                                                           |
| `t`       | integer, Unix seconds      | Required; rounded; within 60 s of relay time                                       |
| `seq`     | integer                    | Required; per-robot counter that only goes up; older values are ignored (H5)       |
| `sid`     | 6 lowercase hex characters | Required; hash of the session ID with a salt fixed for the session's lifetime (H7) |
| `aid`     | 6 lowercase hex characters | Subagents only; required for `spawn` and `done`, never on `start` or `end`         |
| `role`    | string                     | Required; `claude` without `aid`, an allowed agent type with it                    |
| `kind`    | enum                       | `start`, `thinking`, `tool`, `idle`, `end`, `spawn`, `done`                        |
| `cat`     | enum                       | Required when `kind` is `tool`; one of the 12 categories                           |
| `project` | string, max 40 characters  | Optional; must be in `publicProjects`. Absent means the Private projects room      |
| `goal`    | string, max 60 characters  | Optional; only with `project`; no control characters or links; passed H2 locally   |

Headers: `X-Office-Timestamp` and `X-Office-Signature` = hex HMAC-SHA256(secret, timestamp + "." + body). `hivefloor doctor` adds `X-Office-Dry-Run: 1`: the relay verifies the event in full and answers as usual, but changes nothing ([ADR 0012](adr/0012-cli-setup-and-relay-handshake.md)).

**Relay to viewers (WebSocket and `/api/snapshot`)**

```json
{ "type": "snapshot", "v": 1, "at": 1794091200,
  "rooms": [ { "id": "ledgerly", "name": "Ledgerly", "color": "#f2a65a", "slot": 0, "floor": 0, "rows": 1, "lit": true },
             { "id": "private", "name": "Private projects", "color": "#8d94ab", "slot": 1, "floor": 0, "rows": 2, "lit": true } ],
  "robots": [ { "key": "a9f3c2", "role": "claude", "room": "ledgerly", "desk": 0, "goal": "Building the paywall screen", "status": "working", "cat": "testing", "since": 1794091180 } ],
  "today": [ { "room": "ledgerly", "cat": "testing", "n": 42 } ] }
{ "type": "room", "v": 1, "room": { "id": "ndop-ui", "name": "Ndop UI", "color": "#b79cf2", "slot": 2, "floor": 0, "rows": 1, "lit": true } }
{ "type": "delta", "v": 1, "robot": { "key": "a9f3c2:4be1d0", "parent": "a9f3c2", "role": "Explore", "room": "ledgerly", "seat": 0, "status": "working", "cat": "reading", "since": 1794091205 } }
{ "type": "leave", "v": 1, "key": "a9f3c2:4be1d0" }
{ "type": "roomClosed", "v": 1, "id": "ndop-ui" }
{ "type": "status", "v": 1, "state": "limited", "until": 1794096000 }
{ "type": "today", "v": 1, "count": { "room": "ledgerly", "cat": "testing", "n": 43 } }
```

Main sessions carry a `desk` number and subagents a `seat` number at the team table. A `room` message is sent when a room opens, grows or shrinks a row, or changes its lights. A `today` message is sent whenever one of today's counts changes, so visitors never poll for them.

The category set is fixed in v1: `reading`, `coding`, `testing`, `vcs`, `terminal`, `research`, `delegating`, `planning`, `designing`, `monitoring`, `integration`, `working`.

Event kinds: `start` and `end` open and close a main session; `spawn` and `done` open and close a subagent; `thinking` is work without a tool; `tool` is work with a tool of category `cat`; `idle` means Claude finished its turn and waits for the owner.

Robot statuses: `working` (using a tool), `thinking` (working without one), `waiting` (the session just started or Claude finished its turn and waits for the owner; the robot stays seated), `idle` (no event for `idleAfterSec`; the robot goes to the coffee corner) and `away` (no event for `awayAfterSec`). After `leaveAfterSec` without events the robot leaves. A robot that leaves is removed with a `leave` message. Office states in `status` messages: `open`, `busy` (viewer cap reached) and `limited` (paused until `until`).

Room ids are the slug of the project name (lowercase letters, digits and hyphens). `private` and `other` are reserved for the Private projects room and the "Other projects" room of E8.

## Engineering standards

The bar is a codebase a stranger can understand in an hour and contribute to in a day.

**Code design**

- **Pure core, thin edges.** Sanitizing, path matching, category mapping, desk assignment, presence rules, the room layout generator and path planning are pure functions with no I/O. Network, file system, WebSocket, Durable Object storage and Three.js rendering live at the edges and call into them.
- **Types as documentation.** No `any`, no non-null assertions outside tests, exhaustive `switch` statements checked with `never`, branded types for IDs (`SessionHash`, `RobotKey`).
- **Small modules.** Aim for files under 300 lines and functions under 40, one responsibility each, named for what they do.
- **Errors.** The hook never throws to its caller; internal functions return typed results. The relay maps validation errors to status codes in one place.
- **Angular.** Standalone components, signals for state, zoneless change detection, `inject()`, feature folders under `core`, `scene`, `overlay` and `demo`. Presentational components take inputs and emit outputs; one store service owns office state.
- **Three.js.** Scene code is framework-agnostic TypeScript under `scene/`, wrapped by one Angular component that runs the render loop outside change detection. Every geometry, material and texture is disposed when its robot or the scene is torn down.

**Documentation**

- TSDoc on every exported function, class and type, with an example where it helps.
- A README in every package and app: what it is, how to run it, how to test it.
- Guides in `docs/`: architecture, privacy, self-hosting, configuration, hooks, character sets, troubleshooting. Diagrams in Mermaid so they render on GitHub. The same files are published at hivefloor.valerymelou.com/docs.
- Architecture decision records in `docs/adr/` (MADR format). Start with: 0001 Cloudflare Durable Objects for the relay; 0002 allowlist-by-construction privacy; 0003 Three.js over a game engine; 0004 goals from Claude's task list; 0005 one robot per Claude instance with hot desks; 0006 two config files; 0007 one room per project with an elastic layout; 0008 Nx for the monorepo.

**Testing**

| Layer      | What                                                                                                                                                                                                                                                           | Target                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `schema`   | Every schema accepts its examples and rejects each invalid field; property tests that the layout never overlaps rooms, never moves an open room and always fits the limits                                                                                     | 95% line coverage                         |
| `cli`      | Unit tests on recorded, scrubbed hook payloads for every event type; property tests that random payloads never produce fields or values outside the schema; integration test that spawns the CLI with stdin and a fake endpoint; a benchmark for hook overhead | 90% line coverage, p95 under 50 ms        |
| `relay`    | Routes, signature, replay and allowlist checks, desk assignment, presence alarms and hibernation behaviour, in the real Workers runtime                                                                                                                        | 85% line coverage                         |
| `web`      | Store, layout generator and path planner as unit tests; overlay components with Angular testing utilities                                                                                                                                                      | 80% line coverage on `core` and `overlay` |
| End to end | Playwright against demo mode: robots appear, sit, walk to coffee and leave; list view matches the scene; axe accessibility checks; screenshots stored as CI artifacts                                                                                          | Runs on every PR                          |

**Continuous integration (GitHub Actions)**

- `ci.yml` on every PR and on `main`: install with a frozen lockfile, then nx affected runs lint, typecheck, unit tests and build for changed projects only; main runs everything.
- A Playwright job in `ci.yml`: against the built web app in demo mode, with WebGL through SwiftShader.
- `release.yml`: Nx Release reads the version plans, bumps versions and writes changelogs; the workflow then publishes the CLI to npm with provenance and tags the office release.
- `deploy-demo.yml`: deploys hivefloor.valerymelou.com (landing page, docs and the maintainer's live office) from `main` using repository secrets. It doubles as the public demo the README links to.
- CodeQL analysis and Dependabot for npm and GitHub Actions.

**Repository hygiene**

- Conventional Commits, enforced by commitlint; protected `main` with required checks.
- PR template with a checklist: tests, docs, version plan, screenshots for visual changes, privacy impact.
- Issue templates for bugs, features and new character sets; `good first issue` labels from day one.
- `CONTRIBUTING.md` with a 5-minute local setup (`pnpm install`, then `pnpm dev` starts the relay locally, the web app and the simulator).
- `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1) and `SECURITY.md`.

**Licensing**

- Code under the MIT licence.
- `THIRD_PARTY_NOTICES.md` credits Three.js (MIT), the RobotExpressive model by Tomás Laulhé / Quaternius (CC0 1.0) and any fonts (SIL Open Font License).

## Hardening and edge cases

These rules come from a review of the design. None change the architecture, but each is a requirement with a test, built in the milestone shown.

| ID  | Case                                                                                              | Rule                                                                                                                                                                                                                                                                                                                                   | Built in   |
| --- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| H1  | Starting Node on every tool call adds 40–100 ms, and some owners install Claude Code without Node | Register every hook with `"async": true`, which Claude Code runs in the background without blocking the tool call, so start-up time never slows Claude down. Also ship the CLI as a single compiled binary (Bun compile or Node single-executable) on GitHub Releases and Homebrew so Node isn't required, with npm as an alternative. | M2, M8     |
| H2  | A task title in a public repo reveals security work, such as "Patch the auth bypass"              | Goal filter: a `blockWords` list (defaults: security, vulnerability, CVE, exploit, token, secret, password, credential) plus custom words; tasks starting with `[private]` are never sent; `hivefloor pause` for sensitive stretches                                                                                                   | M2         |
| H3  | The private room still shows how much private work is happening, and when                         | `privateRoom.visible: false` hides the private room and its robots entirely                                                                                                                                                                                                                                                            | M1, M4, M6 |
| H4  | The two configs disagree on a project name, so events are rejected and the robot never appears    | `doctor` fetches `/api/config` and flags any public project the relay doesn't know; `preview` warns too                                                                                                                                                                                                                                | M3         |
| H5  | Detached senders deliver events out of order                                                      | Each event carries `seq`, a per-robot counter kept in the state file; the Durable Object ignores any `seq` it has already passed                                                                                                                                                                                                       | M1, M2, M4 |
| H6  | Parallel tool calls and subagents fire many hooks at once                                         | One state file per robot, written atomically (write, then rename); a lost debounce update costs at most one extra event                                                                                                                                                                                                                | M2         |
| H7  | A session that runs past 00:00 UTC gets a new hash and turns into a second robot                  | The salt is chosen at `SessionStart` and kept for the life of that session; only new sessions use the new day's salt                                                                                                                                                                                                                   | M2         |
| H8  | A machine clock more than 60 s off is rejected silently                                           | `doctor` compares local time with the relay's `Date` header and warns above 30 s                                                                                                                                                                                                                                                       | M3         |
| H9  | `/clear`, crashes and sleep leave robots behind                                                   | A `SessionEnd` caused by `/clear` makes the robot leave at once; otherwise the presence alarm marks it away; after sleep, the robot walks back in on the next event                                                                                                                                                                    | M2, M4     |
| H10 | Sessions not on the owner's machine (Claude Code on the web, CI)                                  | Not supported in v1 and documented; the secret must never be committed to a repo                                                                                                                                                                                                                                                       | M8         |
| H11 | Once the daily limit is hit, the Worker can't run, so it can't announce "Office closed"           | The web app infers it from a 429 or Cloudflare error 1027 on `/live` or `/api/*`, and shows "Office closed until 01:00" (next UTC midnight in the owner's timezone)                                                                                                                                                                    | M5, M7     |
| H12 | A viral page: overflow viewers polling every 30 s would use about 4,000 requests a minute         | Above the viewer cap, show a static "busy" view that polls every 2–5 minutes with jitter; the free plan's one rate-limiting rule protects `/ingest`                                                                                                                                                                                    | M4, M7     |
| H13 | Repacking rooms on page load would give two visitors two different layouts                        | Only the Durable Object assigns and repacks room slots, at the daily reset or when the office is empty, and broadcasts the result; browsers never repack                                                                                                                                                                               | M4, M6     |
| H14 | Removing a desk row could move a seated robot                                                     | Only trailing empty rows are removed; a seated robot never moves                                                                                                                                                                                                                                                                       | M1, M6     |
| H15 | Two public projects with the same name, or a renamed project                                      | Config validation requires unique names and slugs; a rename opens a new room and splits today's counts, which is documented                                                                                                                                                                                                            | M1         |
| H16 | A fork's committed `office.config.json` causes merge conflicts and publishes the owner's setup    | The repo ships `office.config.example.json`; the real file is git-ignored, and `hivefloor deploy` validates it and runs Wrangler                                                                                                                                                                                                       | M3, M8     |
| H17 | Names and trademarks                                                                              | "Claude" is used only to describe what a robot is; no Anthropic logos; the README says the project is not affiliated with Anthropic                                                                                                                                                                                                    | M8         |

## Build plan for Claude Code

Nine milestones, built in order, each also closing the hardening rules (H1–H17) mapped to it and ending in a reviewable pull request with green CI. Claude Code stops at the end of each milestone for review before starting the next.

1. **M0 · Foundations.** Scaffold the monorepo (Nx on pnpm workspaces, shared TypeScript, ESLint and Prettier config, module-boundary tags, no Nx Cloud connection), `ci.yml`, commitlint, Nx Release with version plans, Dependabot, CodeQL, issue and PR templates, `LICENSE`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CONTRIBUTING.md` skeleton, `docs/` skeleton, ADRs 0001–0006, `CLAUDE.md`.
   - Done when `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passes locally and in CI on empty packages.
2. **M1 · Schema.** All Zod schemas from Data contracts, inferred types, constants (categories, kinds), example fixtures, JSON Schema generation for both config files, and the pure \`layout\` function (room slots and floors, desk rows, table seats, render caps).
   - Done when every schema has accept and reject tests (95% coverage) and CI fails if generated JSON Schema drifts from the source.
3. **M2 · CLI core.** Pure modules for project resolution, tool categories, identity and hashing, goal extraction, sanitizing and debounce; the `hook` command; the detached signed sender; the compiled binary build (H1). Add a `--record` debug flag that saves scrubbed real payloads as test fixtures.
   - Done when unit and property tests pass, a test proves nothing is ever printed to stdout, and the benchmark shows p95 under 50 ms.
4. **M3 · CLI commands.** `init` (with settings backup and idempotent merge), `doctor`, `preview`, `pause`, `resume`, `uninstall`, plus deploy (H16); the CLI README.
   - Done when integration tests run each command against a temporary home folder, including Windows-style paths, and running `init` twice changes nothing the second time.
5. **M4 · Relay.** Hono routes, ingest verification (size, time, signature, replay, schema, allowlists), the Office Durable Object with SQLite tables and migrations, room lifecycle (open, grow, shrink, dim, close), desk and seat assignment through \`layout\`, presence alarms, today's counts, WebSocket hibernation, `/api/config`, `/api/snapshot`, viewer cap, `_headers`.
   - Done when the Workers-runtime tests pass (85% coverage), and `wrangler dev` plus `hivefloor doctor` shows a test event arriving end to end on a laptop.
6. **M5 · Web foundation.** Angular app shell, config loading, live connection service with backoff, the office store (reducing snapshot, delta, leave and status messages), the demo simulator emitting the same messages, overlay components built with Ndop UI (set up Tailwind CSS, run npx @ndop/cli init in apps/web, add components with the Ndop CLI, and run npx @ndop/cli verify in CI), and the list view.
   - Done when the app works against both the local relay and `#demo`, unit tests pass, and axe reports no violations.
7. **M6 · 3D office.** Elastic building from the live room list (corridor bays, extra floors, rooms adding desk rows, team tables, instanced furniture), the robot and room render caps with "+N" signs, robots (clone, tint, animations, sitting calibration), path planning with re-planning mid-walk, floating tags, camera controls, robot card, reduced-motion and low-power modes, pausing when hidden. Use the prototype as the visual reference.
   - Done when Playwright scenarios pass in demo mode (a robot arrives and sits, a subagent comes and goes, a robot takes a coffee break and a session ends), screenshots are attached to the PR, and the frame-rate script meets the targets.
8. **M7 · Hardening.** Content Security Policy and headers checked in end-to-end tests, the "Reconnecting" and "Office closed" states, strings file, phone layout, bundle-size budget enforced in CI, rate-limit setup documented.
   - Done when the threat-model tests all exist and pass, and the web build stays under 1.5 MB compressed.
9. **M8 · Docs and first release.** README with a demo GIF, a 10-minute self-hosting guide, configuration reference generated from the schemas, troubleshooting, finished `CONTRIBUTING.md`, `THIRD_PARTY_NOTICES.md`; publish CLI `0.1.0` to npm; build apps/site (landing page with the live office as its hero, docs rendered from docs/) and go live at hivefloor.valerymelou.com with the office at /office; tag `v0.1.0`.
   - Done when someone who has never seen the repo follows the README from clone to a live office in under 10 minutes.

Tip: once M2 and M4 work, install the hook on this repo itself. Claude Code building Hivefloor then shows up in your own office.

## Decisions and open questions

**Decided on 8 November 2026**

- [x] **Name:** Hivefloor. Publish `hivefloor` 0.0.1 on npm during M0 to claim it.
- [x] **Overlay components:** Ndop UI from [ndop.dev](https://ndop.dev), installed with `npx @ndop/cli init` (Angular 21 or 22) on top of Tailwind CSS, which Ndop requires. See its [CLI docs](https://ndop.dev/docs/getting-started/cli).
- [x] **Licence:** MIT.
- [x] **Character set:** the CC0 RobotExpressive model for v1.
- [x] **Task-list tools:** since Claude Code v2.1.142, `TaskCreate` and `TaskUpdate` replace `TodoWrite` by default ([tools reference](https://code.claude.com/docs/en/tools-reference)). Support both; M2 records real payloads to confirm field names. Superseded on 8 November 2026 by ADR 0010: on current models the task tools are off by default, so the session title is the fallback goal.
- [x] **Hook latency:** hooks are registered with `"async": true`, so Claude Code runs them in the background ([hooks reference](https://code.claude.com/docs/en/hooks)).
- [x] **Public demo:** hivefloor.valerymelou.com is the project's only home: landing page and docs (apps/site) plus the maintainer's live office as the demo. No separate domain.
- [x] **Grouping rooms:** not in v1, but `group` is accepted in the config and passed to the layout function so it can arrive in v1.1 without a breaking change.

**Decided in M1 (8 November 2026)** — see [ADR 0007](adr/0007-elastic-office-layout.md) and [ADR 0009](adr/0009-v1-contract-details.md)

- [x] **Robot statuses and office states:** `working`, `thinking`, `idle`, `away`; `open`, `busy`, `limited`.
- [x] **Event rules:** strict objects; `seq` in every event; `aid` and role rules per kind.
- [x] **Layout split:** pure assignment helpers for the relay (slots, desks, seats, rows, closing) and a pure `layout()` for drawing; the "Other projects" room takes the lowest folded slot.

**Decided in M2 (8 November 2026)** — see [ADR 0010](adr/0010-goals-from-task-or-session-title.md) and [ADR 0011](adr/0011-compiled-binary-with-bun.md)

- [x] **Goal source:** the in-progress task subject, else the session title; `goals.fromSessionTitle` added to the machine config.
- [x] **Compiled binary:** Bun `--compile` for five targets; npm package bundled with tsdown.
- [x] **Hooks registered (M3):** `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `Stop`, `SubagentStart`, `SubagentStop`, `TaskCreated`, `TaskCompleted`, `SessionEnd`, all with `"async": true`.

**Decided in M3 (8 November 2026)** — see [ADR 0012](adr/0012-cli-setup-and-relay-handshake.md)

- [x] **Doctor dry run:** `X-Office-Dry-Run: 1` on `POST /ingest`; the relay verifies but changes nothing (M4).
- [x] **Office config delivery:** `hivefloor deploy` passes the validated config as the `OFFICE_CONFIG` variable (M4 reads it).
- [x] **Hook command:** absolute paths to the binary, or to Node and the script; `npx` only as a fallback with a warning.
- [x] **init** can also mark the current folder as a public project (`--public NAME`, or a question when interactive).

**Decided in M4 (8 November 2026)** — see [ADR 0013](adr/0013-relay-office-state.md)

- [x] **Status `waiting`:** seated after `start` and `Stop`; `idle` (coffee corner) only after `idleAfterSec`, as in use case 5.
- [x] **`presence.leaveAfterSec`** (default 3,600 s): robots without events leave, so sessions that never sent `SessionEnd` don't stay forever.
- [x] **Ingest answers:** 413 too large, 401 timestamp or signature, 400 schema, 422 not in the allowlists, 409 replay, 503 not configured, 204 success. The event's `t` may lag relay time by up to 120 s because of rounding; the header timestamp has the strict 60 s window.
- [x] **Viewer cap:** visitors beyond it get a `busy` status message and the socket closes.

**Decided in M5 (8 November 2026)** — see [ADR 0014](adr/0014-web-foundation.md)

- [x] **`today` viewer message:** the relay pushes count changes; the snapshot still carries all counts.
- [x] **Ndop UI in Nx:** manual setup per Ndop's Nx guide; `pnpm nx run web:verify-ui` wraps `ndop verify`; `@angular/cdk` and `@angular/forms` added for Ndop's primitives.
- [x] **The relay serves the built web app**, with the security headers in `apps/web/public/_headers`.

**Decided in M6 (8 November 2026)** — see [ADR 0015](adr/0015-3d-office.md)

- [x] **Model compression:** quantization rather than meshopt: 19 KB more, but no WebAssembly decoder and no `wasm-unsafe-eval` in the Content Security Policy.
- [x] **A coffee corner on every floor,** in the lobby at the west end, opposite the stairs, so a break doesn't mean a walk between floors.
- [x] **Away robots leave the building** and walk back in on their next event (H9); they stay in the list view.
- [x] **Browsers without a GPU** count as low-power (W10), as phones do.
- [x] **`#demo-crowd`** starts the simulator with ten sessions, the load the frame-rate targets are set for.

**Decided after M6 (8 November 2026)** — see [ADR 0015](adr/0015-3d-office.md)

- [x] **Compact tags:** three-line tags collided at neighbouring desks, so a tag is an icon until it's hovered or its robot's activity changes (W4).

**Decided in M7 (8 November 2026)**

- [x] **The closed office checks every 2–5 minutes** rather than every 30 s, because it stays closed until the daily reset (H11, H12).
- [x] **Bundle budget:** `pnpm nx run web:size` fails CI above 1.5 MB gzipped, counting the scripts, styles, page, robot model and two Latin fonts.
- [x] **On phones, a vertical swipe on the office scrolls the page;** a horizontal swipe orbits.

**Decided in M8 (8 November 2026)** — see [ADR 0016](adr/0016-site-and-release.md)

- [x] **Deploying sets the secret:** `hivefloor deploy` offers to create it and set it on the relay, so setup runs in order. It never replaces a secret unattended.
- [x] **`BASE_PATH`:** the relay serves its routes under a base path, so one Worker can host the site at `/` and the office at `/office`.
- [x] **Homebrew is deferred:** the standalone binaries on GitHub Releases cover machines without Node (H1); a tap needs its own repository.

**Still open:** nothing right now. Revisit this list at the start of each milestone.
