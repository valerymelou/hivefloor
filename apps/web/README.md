# Hivefloor office (web app)

The Angular app visitors open: a live view of the office built from the relay's messages. M5 delivers the overlay and the list view; the 3D scene arrives in M6. Design: [ADR 0014](../../docs/adr/0014-web-foundation.md).

## Code

| Folder        | What                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `core/`       | The signal store (`office-store.ts`), the pure message reducer and feed, the live connection with backoff, timing and copy. |
| `demo/`       | The seeded simulator behind `#demo`, emitting exactly the relay's messages.                                                 |
| `overlay/`    | Presentational components: header, feed, Building in public, today's counts, privacy note, list view.                       |
| `ui/`, `lib/` | Ndop UI components and helpers, copied in by `ndop add`. Change them with `pnpm exec ndop update`, not by hand.             |

All overlay copy lives in `core/strings.ts`.

## Run

```bash
pnpm dev                        # relay on :8787 (serving the built app) and this app on :4200, proxied to the relay
pnpm nx serve web               # just this app; open http://localhost:4200/#demo for the simulator
```

## Test and check

```bash
pnpm nx test web                # Vitest with jsdom, 80% coverage on core, overlay and demo; axe on every overlay component
pnpm nx build web               # production build into dist/apps/web
pnpm nx run web:verify-ui       # ndop verify (usage, build, lint; render needs Chromium for Playwright)
pnpm exec ndop add <component>  # add an Ndop UI component (ndop.json is at the repository root)
```
