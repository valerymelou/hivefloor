---
__default__: minor
---

Add the setup commands: `init` (writes the config and secret and registers the Claude Code hooks, idempotently and with a settings backup), `doctor` (checks the setup, project names and clock against the relay and sends a dry-run test event), `preview`, `pause`, `resume`, `uninstall` and `deploy`. The package now ships `machine.schema.json` for editor autocomplete.
