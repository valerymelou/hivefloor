# @hivefloor/schema

The single source of truth for Hivefloor's data contracts. Every other project may import it; it imports nothing from them (`type:shared`).

## What's inside

| Module              | Exports                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `constants.ts`      | `CATEGORIES`, `EVENT_KINDS`, `ROBOT_STATUSES`, `OFFICE_STATES`, reserved room ids, limits, palette                          |
| `primitives.ts`     | Branded ids (`SessionHash`, `AgentHash`, `RobotKey`, `RoomId`), names, goals, roles                                         |
| `office-config.ts`  | `OfficeConfigSchema` for `office.config.json`, `DEFAULT_LAYOUT_LIMITS`                                                      |
| `machine-config.ts` | `MachineConfigSchema` for `~/.config/hivefloor/config.json`                                                                 |
| `ingest-event.ts`   | `IngestEventSchema` and `INGEST_EVENT_FIELDS`, the privacy allowlist                                                        |
| `messages.ts`       | `ViewerMessageSchema`: snapshot, room, delta, leave, roomClosed, status                                                     |
| `layout/`           | Pure assignment helpers for the relay and `layout()` for drawing ([ADR 0007](../../docs/adr/0007-elastic-office-layout.md)) |
| `json-schema.ts`    | `configJsonSchema()`, used to generate `office.schema.json` and `machine.schema.json`                                       |
| `fixtures/`         | The PRD examples, importable in tests as `@hivefloor/schema/fixtures`                                                       |

```ts
import { IngestEventSchema } from '@hivefloor/schema';

const result = IngestEventSchema.safeParse(body);
if (!result.success) return new Response(null, { status: 400 });
```

Runtime dependency: [Zod 4](https://zod.dev). Field reference: [docs/configuration.md](../../docs/configuration.md).

## Develop

```bash
pnpm nx test schema          # unit and property tests, 95% coverage minimum
pnpm nx typecheck schema
pnpm nx lint schema
pnpm nx run schema:json-schema   # regenerate the JSON Schema files after a config change
```
