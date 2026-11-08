# Hivefloor relay

The Cloudflare Worker and the `Office` Durable Object that receive events from `hivefloor hook`, keep the office state and push every change to visitors. Runs on Cloudflare's free plan. Design: [ADR 0001](../../docs/adr/0001-cloudflare-durable-objects.md), [ADR 0013](../../docs/adr/0013-relay-office-state.md).

## Routes

| Route               | What it does                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `POST /ingest`      | Verifies a signed event (size, time, signature, schema, allowlists, replay) and applies it. Answers a bare status code. |
| `GET /live`         | WebSocket: one `snapshot`, then `room`, `delta`, `leave` and `roomClosed` messages. `busy` beyond the viewer cap.       |
| `GET /api/config`   | The public office config (cached 60 s).                                                                                 |
| `GET /api/snapshot` | The current office (cached 5 s).                                                                                        |
| everything else     | Static assets from `public/` (the office web app from M5), with security headers from `public/_headers`.                |

`POST /ingest` answers 204 on success, 413 (too large), 401 (timestamp or signature), 400 (schema), 422 (not in the allowlists), 409 (replay) or 503 (not configured). With `X-Office-Dry-Run: 1` it verifies and changes nothing.

## Code

- `src/app.ts`: Hono routes. `src/index.ts`: the main module (only the handler and the Durable Object class).
- `src/ingest/verify.ts`: request verification and the status-code table.
- `src/state/office.ts`: the pure reducer (events, presence, daily reset, alarms). `src/state/view.ts`: viewer messages. `src/state/store.ts`: SQLite tables, migrations and diff writes.
- `src/office.ts`: the Durable Object: persistence, broadcast, alarms, hibernating WebSockets.

## Run locally

```bash
cp apps/relay/.dev.vars.example apps/relay/.dev.vars   # set HIVEFLOOR_SECRET
pnpm nx dev relay                                         # http://localhost:8787
hivefloor init --url http://localhost:8787 --secret-stdin < secret.txt
hivefloor doctor
```

In development the office config comes from `wrangler.jsonc` (the example office); `hivefloor deploy` replaces it with your validated `office.config.json`.

## Test and build

```bash
pnpm nx test relay        # in the real Workers runtime (workerd), 85% coverage minimum
pnpm nx typecheck relay
pnpm nx lint relay
pnpm nx build relay       # wrangler deploy --dry-run into dist/apps/relay
pnpm nx types relay       # regenerate worker-configuration.d.ts after a compatibility date change
```
