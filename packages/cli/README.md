# hivefloor

The command-line tool that connects Claude Code to your [Hivefloor](https://github.com/valerymelou/hivefloor) office: a live 3D view of your sessions as robots.

## Quick start

```bash
npm install -g hivefloor                         # or use a standalone binary (no Node needed)
hivefloor init --url https://your-office.example.com
hivefloor doctor
```

Run `hivefloor init --public "Ledgerly"` from a project folder to show it by name; every other folder stays private. Deploying your own office: [self-hosting guide](https://github.com/valerymelou/hivefloor/blob/main/docs/self-hosting.md).

- **Private by construction.** Each event is built field by field from the allowlist in `@hivefloor/schema`. Private projects send only which robot, what kind of work and when. See [privacy](https://github.com/valerymelou/hivefloor/blob/main/docs/privacy.md).
- **Never in Claude's way.** `hivefloor hook` always exits 0, prints nothing and hands sending to a detached process. Hooks are registered with `"async": true`.
- **Zero runtime dependencies.** The npm package is one bundled file for Node 20 or later. Standalone binaries (no Node needed) are built with Bun.

## Commands

| Command                                      | What it does                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `hivefloor init [--url URL] [--public NAME]` | Writes the config and secret and registers the Claude Code hooks. Safe to run again; backs up settings.     |
| `hivefloor init --rotate`                    | Creates a new secret (set it on the relay too).                                                             |
| `hivefloor init --secret-stdin`              | Reads the relay's existing secret from stdin.                                                               |
| `hivefloor doctor`                           | Checks config, secret, hooks, relay, names and clock; sends a dry-run event; shows what leaves the machine. |
| `hivefloor preview`                          | Prints the event a hook payload on stdin would send, without sending it.                                    |
| `hivefloor pause` / `resume`                 | Stops or restarts sending.                                                                                  |
| `hivefloor uninstall [--purge]`              | Removes only Hivefloor's hooks; `--purge` also deletes the config, secret and state.                        |
| `hivefloor deploy [--dry-run]`               | From a Hivefloor checkout: validates `office.config.json` and deploys the relay with Wrangler.              |
| `hivefloor hook [--record]`                  | Reads one hook payload from stdin. Used by the hooks; `--record` saves a scrubbed copy.                     |
| `hivefloor --version`                        | Prints the version.                                                                                         |

Set `HIVEFLOOR_DEBUG=1` to log each decision (never the payload) to `debug.log`, and `HIVEFLOOR_HOME` to use another folder than `~/.config/hivefloor`. Details: [docs/hooks.md](https://github.com/valerymelou/hivefloor/blob/main/docs/hooks.md).

## Develop

```bash
pnpm nx test cli         # unit, property and integration tests (90% coverage minimum); builds first
pnpm nx build cli        # bundle to dist/packages/cli/bin.mjs with tsdown
pnpm nx bench cli        # hook benchmark of the Node bundle (CI gates the binary at p95 < 50 ms)
pnpm nx compile cli      # standalone binaries with bun build --compile (needs Bun 1.4)
```

Code layout: `src/core/` holds pure functions (payload reading, project matching, categories, identity, goals, debounce, event building, `decide`, settings merging, doctor checks); `src/edge/` holds file, config and network I/O; `src/commands/` holds one module per command; `src/main.ts` dispatches and `src/bin.ts` wires in the process.

## Licence

MIT
