# hivefloor

The command-line tool that connects Claude Code to your [Hivefloor](https://github.com/valerymelou/hivefloor) office: a live 3D view of your sessions as robots.

> Status: the hook works; setup commands (`init`, `doctor`, `preview`, `pause`, `resume`, `uninstall`) arrive in the next release. Until then the CLI isn't useful on its own.

- **Private by construction.** Each event is built field by field from the allowlist in `@hivefloor/schema`. Private projects send only which robot, what kind of work and when. See [privacy](https://github.com/valerymelou/hivefloor/blob/main/docs/privacy.md).
- **Never in Claude's way.** `hivefloor hook` always exits 0, prints nothing and hands sending to a detached process. Hooks are registered with `"async": true`.
- **Zero runtime dependencies.** The npm package is one bundled file for Node 20 or later. Standalone binaries (no Node needed) are built with Bun.

## Commands

| Command                   | What it does                                                      |
| ------------------------- | ----------------------------------------------------------------- |
| `hivefloor hook`          | Reads one Claude Code hook payload from stdin. Used by the hooks. |
| `hivefloor hook --record` | Same, and saves a scrubbed copy of the payload to `recordings/`.  |
| `hivefloor --version`     | Prints the version.                                               |

Set `HIVEFLOOR_DEBUG=1` to log each decision (never the payload) to `debug.log`, and `HIVEFLOOR_HOME` to use another folder than `~/.config/hivefloor`. Details: [docs/hooks.md](https://github.com/valerymelou/hivefloor/blob/main/docs/hooks.md).

## Develop

```bash
pnpm nx test cli         # unit, property and integration tests (90% coverage minimum); builds first
pnpm nx build cli        # bundle to dist/packages/cli/bin.mjs with tsdown
pnpm nx bench cli        # hook benchmark of the Node bundle (CI gates the binary at p95 < 50 ms)
pnpm nx compile cli      # standalone binaries with bun build --compile (needs Bun 1.4)
```

Code layout: `src/core/` holds pure functions (payload reading, project matching, categories, identity, goals, debounce, event building, `decide`); `src/edge/` holds file, config and network I/O; `src/main.ts` dispatches commands and `src/bin.ts` wires in the process.

## Licence

MIT
