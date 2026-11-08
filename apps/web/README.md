# Hivefloor office (web app)

The Angular app visitors open: a live view of the office built from the relay's messages. It has the 3D office, the overlay and a list view of everyone.

## Code

| Folder        | What                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `core/`       | The signal store (`office-store.ts`), the pure message reducer and feed, the live connection with backoff, timing and copy. |
| `demo/`       | The seeded simulator behind `#demo`, emitting exactly the relay's messages. `#demo-crowd` starts with ten sessions.         |
| `scene/`      | The 3D office: pure geometry, walks and behaviour, with all Three.js code in `scene/render/`.                               |
| `office/`     | The Angular component that wraps the scene.                                                                                 |
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
pnpm nx run web:size            # fails above 1.5 MB gzipped (first visit, including Three.js and the model)
pnpm nx run web:verify-ui       # ndop verify on src/app/overlay (usage, build, lint; render needs Chromium for Playwright)
pnpm exec ndop add <component>  # add an Ndop UI component (ndop.json is at the repository root)
```

## Modes

The URL hash picks a mode, and flags combine with `&`: `#demo` runs the simulator, `#demo-crowd` starts it with ten sessions, and `#embed` shows only the office and a small live badge. `pnpm nx run web:build:office-subpath` builds the app for serving under `/office/`.
