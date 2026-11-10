## 0.1.1 (2026-11-10)

### 🩹 Fixes

- Fix `hivefloor init` after `npm install -g`: it registered `node hook` with no script, so the hook never ran and no robots appeared. Running `init` again replaces the broken entries, and `uninstall` now removes them. ([257f2f9](https://github.com/valerymelou/hivefloor/commit/257f2f9))

### ❤️ Thank You

- Valery Melou @valerymelou

## 0.1.0 (2026-11-08)

### 🚀 Features

- Add `hivefloor hook`: reads a Claude Code hook payload, builds a sanitized event (robot, kind, category, time, and for public projects the project name and goal) and sends it signed from a detached process. It always exits 0 and never prints. Goals come from the in-progress task or the session title. Includes `--record` for scrubbed payload fixtures and a standalone binary build. ([60dd7b5](https://github.com/valerymelou/hivefloor/commit/60dd7b5))
- Add `hivefloor add-project NAME`, which makes a project public in one step: it updates the machine config for the folder and the `publicProjects` allowlist in `office.config.json` (or says exactly what to add on the relay), and can deploy with `--deploy`. It writes nothing when run again with the same arguments. ([8b1185c](https://github.com/valerymelou/hivefloor/commit/8b1185c))
- `hivefloor deploy` now offers to create the shared secret and set it on the relay, so setup runs in order; `--push-secret` does it without asking. ([8cd1bd0](https://github.com/valerymelou/hivefloor/commit/8cd1bd0))
- Add the setup commands: `init` (writes the config and secret and registers the Claude Code hooks, idempotently and with a settings backup), `doctor` (checks the setup, project names and clock against the relay and sends a dry-run test event), `preview`, `pause`, `resume`, `uninstall` and `deploy`. The package now ships `machine.schema.json` for editor autocomplete. ([e2a96ac](https://github.com/valerymelou/hivefloor/commit/e2a96ac))

### ❤️ Thank You

- Valery Melou @valerymelou

## 0.0.1 (2026-11-08)

### 🩹 Fixes

- Publish a placeholder hivefloor package to reserve the npm name. It has no commands yet. ([204d3ce](https://github.com/valerymelou/hivefloor/commit/204d3ce))

### ❤️ Thank You

- Valery Melou @valerymelou