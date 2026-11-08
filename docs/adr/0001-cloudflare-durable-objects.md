# 0001. Use Cloudflare Workers and one Durable Object for the relay

- Status: accepted
- Date: 2026-11-08
- Deciders: Valery Melou

## Context and problem statement

The office must update every open browser within a second of a Claude Code event, cost nothing to run, and be deployable by anyone in about ten minutes without owning a server. Something has to receive events, hold the current office state and fan changes out to visitors.

## Decision drivers

- $0 per month on a free plan, including on a busy day (about 2,000 events and 1,000 visitors).
- Push updates to browsers in real time without paying for idle connections.
- One-command deploy; no server, database or container to look after.
- Strongly consistent state, so every visitor sees the same robot at the same desk.

## Considered options

1. Cloudflare Workers with one SQLite-backed Durable Object using WebSocket hibernation.
2. A small Node server with WebSockets on a VPS or a free PaaS tier.
3. A hosted realtime service (Supabase Realtime, Firebase, Pusher, Ably).
4. Polling a key-value store (Workers KV) from the browser.

## Decision outcome

Chosen option: **Workers with one Durable Object**, because a single Durable Object gives a strongly consistent place for the office state, its SQLite storage keeps it across restarts, and the WebSocket Hibernation API lets thousands of idle viewers stay connected without the object being billed or kept awake. Static assets are served free, and `wrangler deploy` is the whole deploy.

### Consequences

- Good: free for the target load, globally reachable, no server to maintain, one deploy command.
- Good: one object means one writer, so desk assignment and room slots need no distributed locking.
- Bad: tied to Cloudflare. The pure core (schema, layout, state rules) stays platform-neutral to keep a port possible.
- Bad: free-plan request limits are hard limits; when they are hit the Worker stops until the daily reset. The web app must infer that state (H11) and the viewer cap protects the budget (H12).
- Bad: Durable Object code must avoid timers and open requests that prevent hibernation; alarms run only while robots are present.

## More information

- PRD: Architecture, Relay requirements R1–R9, Non-functional requirements (Cost, Durable Object).
