# Configuration

Hivefloor uses two config files on purpose ([ADR 0006](adr/0006-two-config-files.md)):

- **`office.config.json`** is public. It describes the office and is served to every visitor at `/api/config`; the relay also builds its allowlists from it. The repository ships [`office.config.example.json`](../office.config.example.json); your real copy is git-ignored.
- **`~/.config/hivefloor/config.json`** lives only on your machine. It is never committed or uploaded. The shared secret sits next to it in a `secret` file with mode 600, never in the JSON.

Both files are validated by the Zod schemas in `packages/schema` and have generated JSON Schema for editor autocomplete. Unknown fields are errors in both, so a typo never goes unnoticed.

> This page is written by hand for now. In M8 it is generated from the schemas so it can't drift.

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

| Field                      | Type               | Default              | Notes                                                                                |
| -------------------------- | ------------------ | -------------------- | ------------------------------------------------------------------------------------ |
| `v`                        | `1`                | required             | Contract version.                                                                    |
| `title`                    | text, 1–40         | `"Hivefloor"`        | Shown in the overlay.                                                                |
| `owner`                    | text, 1–40         | required             | Shown in the overlay.                                                                |
| `timezone`                 | IANA time zone     | required             | For example `Africa/Douala`; used for "Office closed until …".                       |
| `publicProjects[]`         | list, up to 100    | `[]`                 | Projects whose name and goal visitors may see. Everything else is private.           |
| `publicProjects[].name`    | text, 1–40         | required             | Unique, ignoring case. Its room id is its slug (`Ndop UI` → `ndop-ui`), also unique. |
| `publicProjects[].color`   | `#rrggbb`          | from the palette     | Without it, a colour is picked from a fixed palette by a hash of the name.           |
| `publicProjects[].group`   | slug such as `web` | none                 | Stored for later grouping into wings or floors; not used in v1.                      |
| `privateRoom.name`         | text, 1–40         | `"Private projects"` | The shared room for all private sessions.                                            |
| `privateRoom.color`        | `#rrggbb`          | `"#8d94ab"`          |                                                                                      |
| `privateRoom.visible`      | boolean            | `true`               | `false` hides the private room and its robots from visitors entirely.                |
| `agentTypes`               | list of type names | `["Helper"]`         | Subagent roles the relay accepts. `claude` is reserved.                              |
| `presence.idleAfterSec`    | 30–3600            | `180`                | No event for this long: the robot goes to the coffee corner.                         |
| `presence.awayAfterSec`    | 60–86400           | `900`                | No event for this long: the robot is away. Must be more than `idleAfterSec`.         |
| `presence.leaveAfterSec`   | 120–604800         | `3600`               | No event for this long: the robot leaves. Must be more than `awayAfterSec`.          |
| `layout.roomsPerFloor`     | even, 2–16         | `8`                  | Rooms sit in pairs across the corridor.                                              |
| `layout.desksPerRow`       | 1–6                | `3`                  |                                                                                      |
| `layout.maxRowsPerRoom`    | 1–8                | `4`                  | Beyond the last desk, robots stand.                                                  |
| `layout.tableSeats`        | 1–12               | `6`                  | Subagents sit at the team table; beyond it they stand around it.                     |
| `layout.roomCloseAfterSec` | 60–86400           | `1800`               | An empty room closes after this long. The private room never closes.                 |
| `layout.rowRemoveAfterSec` | 0–86400            | `600`                | An unused trailing desk row is removed after this long.                              |
| `layout.maxRenderedRobots` | 1–500              | `40`                 | Beyond it, the least recently active robots show as "+N".                            |
| `layout.maxVisibleRooms`   | 2–64               | `12`                 | Beyond it, the quietest rooms fold into an "Other projects" room.                    |
| `viewerCap`                | 1–10000            | `500`                | Visitors beyond it get a lighter view that polls every few minutes.                  |

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

| Field                    | Type                     | Default            | Notes                                                                                                                                     |
| ------------------------ | ------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `v`                      | `1`                      | required           | Contract version.                                                                                                                         |
| `endpoint`               | URL                      | required           | Your relay's `/ingest`. Must be `https`, except `http://localhost` for development.                                                       |
| `projects[]`             | list                     | `[]`               | Folders and whether they are public. Any folder not listed is private.                                                                    |
| `projects[].path`        | path                     | required           | Absolute or starting with `~`. The longest matching prefix wins.                                                                          |
| `projects[].public`      | boolean                  | required           |                                                                                                                                           |
| `projects[].name`        | text, 1–40               | required if public | Must match a `publicProjects[].name` in `office.config.json`.                                                                             |
| `publicAgentTypes`       | list of type names       | `[]`               | Subagent types shown by name; others appear as `Helper`.                                                                                  |
| `goals.fromTaskList`     | boolean                  | `true`             | Use the in-progress task (when Claude Code's task tools are on) as the goal, for public projects only.                                    |
| `goals.fromSessionTitle` | boolean                  | `true`             | Otherwise use the session's custom title (`claude --name`, `/rename`) as the goal, for public projects only.                              |
| `goals.maxLength`        | 10–60                    | `60`               |                                                                                                                                           |
| `goals.blockWords`       | list of words            | 8 defaults         | A task title containing one of these is never sent. Defaults: security, vulnerability, CVE, exploit, token, secret, password, credential. |
| `goals.privatePrefix`    | text                     | `"[private]"`      | A task title starting with this is never sent.                                                                                            |
| `mcpCategories`          | map of server → category | `{}`               | Category for each local MCP server. Server names never leave your machine.                                                                |
| `timestampRoundingSec`   | 1–60                     | `5`                | Event times are rounded to this many seconds.                                                                                             |
| `paused`                 | boolean                  | `false`            | `true` stops sending without uninstalling (`hivefloor pause`).                                                                            |

## Categories

Every tool call maps to one of 12 fixed categories: `reading`, `coding`, `testing`, `vcs`, `terminal`, `research`, `delegating`, `planning`, `designing`, `monitoring`, `integration`, `working`.

## Regenerating the JSON Schema

```bash
pnpm nx run schema:json-schema
```

CI fails if the committed `packages/schema/*.schema.json` files don't match the Zod source.
