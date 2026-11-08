# Configuration reference

This page is generated from the schemas in `packages/schema`. To change it, change them. For how the two files fit together, see [Configuration](configuration.md).

## `office.config.json`

The public office config. It is served to every visitor.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `v` | `1` | required | The config version. Always 1. |
| `title` | text | `"Hivefloor"` | The office name, shown in the header. |
| `owner` | text | required | Your name, shown under the title. |
| `timezone` | text | required | Your IANA time zone, such as "Africa/Douala". Used for the daily reset time. |
| `publicProjects` | list of object | `[]` | Projects shown by name. Everything else goes to the private room. |
| `publicProjects[].name` | text | required | The room name. Must match the project name in the machine config exactly. |
| `publicProjects[].color` | text | optional | The room colour as #rrggbb. Without one, a colour is picked from a fixed palette. |
| `publicProjects[].group` | text | optional | A lowercase slug such as "web". Stored, but not used yet. |
| `privateRoom` | object | see below | The shared room for every private session. |
| `privateRoom.name` | text | `"Private projects"` | The room name. |
| `privateRoom.color` | text | `"#8d94ab"` | The room colour as #rrggbb. |
| `privateRoom.visible` | true or false | `true` | Set to false to hide the private room and its robots from visitors entirely. |
| `agentTypes` | list of text | `["Helper"]` | Subagent types the relay accepts by name. |
| `presence` | object | see below | When quiet robots go for coffee, step out and leave. |
| `presence.idleAfterSec` | number, 30 to 3600 | `180` | Seconds without an event before a robot goes for coffee. |
| `presence.awayAfterSec` | number, 60 to 86400 | `900` | Seconds without an event before a robot leaves the building until its next event. |
| `presence.leaveAfterSec` | number, 120 to 604800 | `3600` | Seconds without an event before a robot is removed from the office. |
| `layout` | object | see below | Limits of the elastic office. |
| `layout.roomsPerFloor` | number, 2 to 16 | `8` | Rooms on a floor before a new floor starts. Must be even. |
| `layout.desksPerRow` | number, 1 to 6 | `3` | Desks in a row. |
| `layout.maxRowsPerRoom` | number, 1 to 8 | `4` | Desk rows a room can grow to. |
| `layout.tableSeats` | number, 1 to 12 | `6` | Seats for subagents at the team table. |
| `layout.roomCloseAfterSec` | number, 60 to 86400 | `1800` | Seconds a room stays empty before it closes and frees its place. |
| `layout.rowRemoveAfterSec` | number, 0 to 86400 | `600` | Seconds an empty desk row stays before it is removed. |
| `layout.maxRenderedRobots` | number, 1 to 500 | `40` | Robots drawn at once. The rest show as a "+N" sign; the list view shows everyone. |
| `layout.maxVisibleRooms` | number, 2 to 64 | `12` | Rooms drawn at once. The quietest fold into an "Other projects" room. |
| `viewerCap` | number, 1 to 10000 | `500` | Live visitors at once. Others get a view that updates every few minutes. |

## `~/.config/hivefloor/config.json`

The private machine config. It never leaves your machine.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `v` | `1` | required | The config version. Always 1. |
| `endpoint` | text | required | The relay ingest URL: https, or http for localhost only. |
| `projects` | list of object | `[]` | Folders and whether they are public. Any other folder is private. |
| `projects[].path` | text | required | An absolute folder, or one starting with ~. The longest matching path wins. |
| `projects[].public` | true or false | required | Whether sessions here show the project name and goals to visitors. |
| `projects[].name` | text | optional | The project name in office.config.json. Required when public is true. |
| `publicAgentTypes` | list of text | `[]` | Subagent types sent by name. Others are sent as a generic helper. |
| `goals` | object | see below | Which goals are sent for public projects. |
| `goals.fromTaskList` | true or false | `true` | Use the task Claude has in progress. |
| `goals.fromSessionTitle` | true or false | `true` | Use the session title when no task is in progress. |
| `goals.maxLength` | number, 10 to 60 | `60` | Longest goal sent, in characters. |
| `goals.blockWords` | list of text | see below | A goal containing any of these words is not sent. |
| `goals.privatePrefix` | text | `"[private]"` | A task title starting with this is never sent. |
| `mcpCategories` | map | see below | MCP server name to work category. Server names are only read locally. |
| `timestampRoundingSec` | number, 1 to 60 | `5` | Timestamps are rounded to this many seconds, so timing reveals less. |
| `paused` | true or false | `false` | Send nothing. Set by hivefloor pause and resume. |
