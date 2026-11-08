# 0014. Build the office web app on Angular, Ndop UI and one signal store

- Status: accepted
- Date: 2026-11-08
- Deciders: Valery Melou

## Context and problem statement

M5 builds the office web app's foundation: the shell, the connection to the relay, the state on the page, a demo mode and the overlay. The PRD fixes the stack (Angular, Ndop UI on Tailwind CSS v4); this record covers how it is put together in this Nx workspace and the contract addition it needed.

## Decision drivers

- One owner of state, with presentational components that only read it (Engineering standards).
- Demo mode and tests must not need a relay; demo must look exactly like the real thing.
- Small, safe pages: a strict Content Security Policy and text-only rendering (threat model).
- Free plan: no polling by visitors in normal operation.

## Decision outcome

**State.** One `OfficeStore` service owns the page's state as signals. A pure `applyMessage` reducer turns relay messages into the view and reports robot changes, from which pure functions build the activity feed (last 20 entries). Components under `overlay/` only read the store.

**Sources.** An `OfficeSource` either connects to the relay (`LiveSource`: WebSocket to `live`, relative to the page's base URL; reconnects with exponential, jittered backoff capped at 30 s; on a failed connection it fetches `api/snapshot` and shows "Office closed until HH:MM" when the answer is a 429 or Cloudflare's error 1027, H11; when the relay sends `busy`, it polls the snapshot every 2–5 minutes, R7) or simulates one (`DemoSource`, `#demo`). The simulator emits the same messages as the relay and both are validated with the same schema, so the app can't tell them apart.

**Contract addition: `today` message.** Today's counts change on every tool event, but only snapshots carried them, so the overlay would go stale until a reload, and polling would cost the free plan dearly. The relay now sends `{ "type": "today", "v": 1, "count": { "room", "cat", "n" } }` whenever a count changes. Additive within v1.

**Ndop UI in Nx.** `ndop init` and `ndop verify` need an Angular CLI workspace. Following Ndop's Nx guide, `ndop.json` at the root points at `apps/web/src/app/{ui,lib,blocks}`, and `ndop add` writes components there with relative imports. `pnpm nx run web:verify-ui` runs `ndop verify` with a temporary `angular.json` that exists only during the run; CI installs Chromium for its render step. Ndop's copied files keep upstream's style (the `nd` selector prefix), so `ndop update` merges cleanly. Ndop's primitives need `@angular/cdk` and `@angular/forms` (approved).

**Tests.** Angular's own unit-test builder (`@angular/build:unit-test`) with Vitest 5 and jsdom; coverage covers `core/`, `overlay/` and `demo/` at 80%. Overlay components are checked with axe-core (colour contrast is left to browser tests in M6). Nx 24.0.5's generator refuses Vitest 5, although Angular 22.2 supports it, so the target is configured by hand.

**Serving and security.** The relay serves the built app as static assets (`dist/apps/web/browser`, with `public/_headers`); relay build, dev and test depend on the web build as a task, not an import, so module boundaries still hold. The CSP allows only same-origin scripts, styles (plus inline styles), fonts (Geist, self-hosted) and connections; Angular's critical-CSS inlining is turned off because it relies on an inline `onload` handler the CSP blocks. `base-uri 'self'` keeps the `<base href>` working for the `/office/` base path. All text is bound as text, never HTML.

**Bundle size.** The schema package now imports Zod as `import * as z from 'zod'`; the named `z` import kept Zod's 64 locales in every bundle. The web app's initial JavaScript fell from 858 kB to 484 kB (raw), and the relay Worker from 871 kB to 292 kB.

### Consequences

- Good: the store, feed, timing and sources are plain functions or injectable classes with fakes, tested without a browser; the simulator's invariants are tested over 600 steps.
- Good: no polling in normal operation; counts stay current.
- Bad: `ndop verify` needs a wrapper until Ndop supports Nx directly; `ndop doctor` reports three Nx-layout false alarms.
- Bad: the Lucide icon registry adds about 200 kB raw even though M5 shows no icons; revisit when the overlay uses icons.

## More information

- PRD: Office web app W5–W7, W11, W12 (feed collapse); hardening H11, H12; Data contracts (updated in the same pull request).
- Code: `apps/web/src/app/{core,demo,overlay}`.
