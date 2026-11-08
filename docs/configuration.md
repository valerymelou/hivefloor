# Configuration

Hivefloor uses two config files on purpose ([ADR 0006](adr/0006-two-config-files.md)):

- **`office.config.json`** is public. It describes the office and is served to every visitor at `/api/config`; the relay also builds its allowlists from it. The repository ships [`office.config.example.json`](../office.config.example.json); your real copy is git-ignored.
- **`~/.config/hivefloor/config.json`** lives only on your machine. It is never committed or uploaded. The shared secret sits next to it in a `secret` file with mode 600, never in the JSON.

A public project is named in both files, and the names must match exactly: the relay rejects any name that isn't in `publicProjects`. `hivefloor add-project "Name"` updates both at once ([self-hosting](self-hosting.md#3-make-a-project-public)).

Both files are validated by the Zod schemas in `packages/schema` and have generated JSON Schema for editor autocomplete. Unknown fields are errors in both, so a typo never goes unnoticed.

Every field, its default and its limits are in the [configuration reference](configuration-reference.md), generated from the schemas so it can't drift.

## `office.config.json`

```json
{
  "$schema": "./node_modules/@hivefloor/schema/office.schema.json",
  "v": 1,
  "owner": "Valery Melou",
  "timezone": "Africa/Douala",
  "publicProjects": [{ "name": "Ledgerly", "color": "#f2a65a", "group": "mobile" }]
}
```

`private` and `other` can't be used as project names, because those room ids are reserved.

## `~/.config/hivefloor/config.json`

```json
{
  "$schema": "https://unpkg.com/hivefloor/machine.schema.json",
  "v": 1,
  "endpoint": "https://office.example.com/ingest",
  "projects": [{ "path": "~/code/ledgerly", "public": true, "name": "Ledgerly" }]
}
```

## Categories

Every tool call maps to one of 12 fixed categories: `reading`, `coding`, `testing`, `vcs`, `terminal`, `research`, `delegating`, `planning`, `designing`, `monitoring`, `integration`, `working`.

## Regenerating the JSON Schema and the reference

```bash
pnpm nx run schema:json-schema
```

CI fails if the committed `packages/schema/*.schema.json` files or the reference don't match the Zod source.
