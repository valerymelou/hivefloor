# Hivefloor

A self-hostable 3D office that shows Claude Code sessions live as robots, on Cloudflare's free plan.
Full requirements: docs/PRD.md. Decisions: docs/adr/.

## Commands (Nx on pnpm workspaces)

- pnpm install
- pnpm dev relay (wrangler dev, serving the built web app on :8787) + web app dev server (:4200, proxied to the relay); open /#demo for the simulator
- pnpm nx affected -t lint typecheck test build
- pnpm nx run-many -t lint typecheck test build everything, as CI does on main
- pnpm nx e2e web-e2e Playwright against demo mode
- pnpm nx run site:assemble build the site with the office under /office; pnpm nx run web-e2e:site tests it
- pnpm nx graph see how projects depend on each other
- pnpm nx release plan describe a change to a published package

## Map

- packages/schema the contract: Zod schemas, types, constants, layout function. Single source of truth. (type:shared)
- packages/cli hivefloor CLI and the Claude Code hook. Zero runtime dependencies. (scope:cli)
- apps/relay Cloudflare Worker (Hono) + Office Durable Object (SQLite, hibernating WebSockets) (scope:relay)
- apps/web Angular app: core/ (store, live connection), scene/ (Three.js), overlay/, demo/ (scope:web)
- apps/site landing page and docs for hivefloor.valerymelou.com (Analog, Ndop UI, Tailwind) (scope:site)
- apps/web-e2e Playwright tests

## Rules

- Privacy first: events are built field by field from the schema allowlist. Never spread or forward a hook payload.
- The hook must always exit 0, print nothing to stdout, and finish in under 50 ms at p95.
- Pure core, thin edges: logic in pure functions with unit tests; I/O, storage and rendering at the edges.
- Module boundaries: apps and the CLI import only from packages/schema, never from each other.
- TypeScript strict. No any, no non-null assertions outside tests, exhaustive switches.
- Overlay UI uses Ndop UI (https://ndop.dev), a copy-in registry: add and update components with pnpm exec ndop add / update (ndop.json at the root), and run pnpm nx run web:verify-ui (ndop verify for this Nx workspace) before a PR. Don't edit files in apps/web/src/app/ui or lib by hand.
- Angular: standalone components, signals, zoneless, inject(); Three.js code stays framework-agnostic in scene/ and disposes what it creates.
- Every exported symbol has TSDoc. Behaviour changes update docs/. Significant decisions get an ADR.
- Conventional Commits. A version plan for every change to a published package. No Nx Cloud.

## Definition of done

nx affected lint, typecheck, test and build green; coverage targets met (schema 95, cli 90, relay 85, web core 80); docs updated; PR template filled in.
