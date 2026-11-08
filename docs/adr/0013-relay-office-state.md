# 0013. Keep the office in one Durable Object, with a pure reducer and diff writes

- Status: accepted
- Date: 2026-11-08
- Deciders: Valery Melou

## Context and problem statement

M4 builds the relay: verifying events, holding the office state, assigning places, running presence and pushing changes to visitors. [ADR 0001](0001-cloudflare-durable-objects.md) chose Workers and one Durable Object. This record covers how the state is structured, stored and checked, and the contract details M4 settled.

## Decision drivers

- One writer, so every visitor sees the same robot in the same place (E7).
- The free plan: Durable Object SQLite counts rows written per day (100,000), and the object should hibernate between events.
- Testable rules without a runtime; the runtime itself tested too.
- Privacy: no request bodies or headers in logs or storage beyond the allowlisted event.

## Decision outcome

**Shape.** The Worker (`apps/relay/src/app.ts`, Hono) verifies requests and forwards verified events over RPC to one `Office` Durable Object addressed by name. The object keeps the state in memory, loaded from SQLite in its constructor (which also runs after hibernation), and applies every change through a **pure reducer** (`src/state/office.ts`): `applyEvent`, `tick` (presence and housekeeping), `rollDay` (daily reset) and `nextWake` (when the alarm should run). Rooms, desks, seats and rows use the shared `layout` helpers from `packages/schema` (ADR 0007).

**Storage.** SQLite tables `rooms`, `robots`, `today`, `departed` (recently left robots and their last `seq`, so late events can't bring them back, H5) and `seen` (signatures from the last 60 s, R2), with versioned migrations. After each change only the rows that differ are written, inside one synchronous transaction: a typical event writes one or two rows.

**Verification order and answers (R1).** Body over 2 KB → 413; missing or bad timestamp (more than 60 s off) or signature → 401; invalid JSON or schema → 400; a role or project not in the office config (the second gate) → 422; a signature seen in the last 60 s → 409; no `OFFICE_CONFIG` or secret → 503; success → 204. All codes come from one table. The event's own `t` is rounded by the CLI (up to 60 s), so it may lag relay time by up to 120 s; the header timestamp carries the strict 60 s window.

**Dry run and hidden private room.** `X-Office-Dry-Run: 1` stops after verification with 204 (ADR 0012). With `privateRoom.visible: false`, private events are verified and then dropped (H3).

**Statuses and presence (contract additions).** A `Stop` hook means Claude finished its turn and waits for the owner, which needed a status of its own: robots stay seated as **`waiting`** (also on `start`) and only go to the coffee corner as `idle` after `idleAfterSec` without events, matching PRD use case 5. Robots with no event for **`presence.leaveAfterSec`** (new, default 3,600 s) leave, so crashed or closed-without-`SessionEnd` sessions don't stay forever (H9). Subagents of a departed session leave at the next alarm (R5).

**Alarms.** `nextWake` returns the earliest pending presence change, row removal or room closing; with no robots and nothing pending there is no alarm (R5). The daily reset happens lazily on the first event, snapshot or alarm of a new UTC day, so no alarm is needed for it; it resets today's counts and repacks room slots (H13), and visitors get a new snapshot. Slots are also repacked when the last robot leaves.

**Visitors.** `GET /live` upgrades to a hibernatable WebSocket tagged `viewer`, sends a snapshot, then `room`, `delta`, `leave`, `roomClosed` or `snapshot` messages. "ping" is answered by the runtime without waking the object. Beyond `viewerCap`, the socket gets `{"type":"status","state":"busy"}` and closes (1013), because browsers can't read the status of a refused upgrade (R7, H12).

**Responses.** Every Worker response carries `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and a `Date` header (used by `hivefloor doctor` for H8; local workerd doesn't add one). Observability is off in `wrangler.jsonc`; nothing logs. The office web app's pages get the security headers from `public/_headers`.

### Consequences

- Good: the rules are plain functions with property tests (unique desks, seats and slots; every robot in an open room; every message valid against the schema); the runtime behaviour is tested in workerd with `@cloudflare/vitest-plugin`.
- Good: about three SQLite rows written per event, well inside the free plan.
- Bad: one object is a single point of throughput; v1's target (a few sessions, about 2,000 events a day) is far below its limits.
- Bad: two contract additions (`waiting`, `leaveAfterSec`) that the web app must handle in M5; both are additive.

## More information

- PRD: Relay requirements R1–R8, elastic office E1–E9, hardening rules H3, H5, H9, H12, H13 (updated in the same pull request).
- Code: `apps/relay/src/`.
