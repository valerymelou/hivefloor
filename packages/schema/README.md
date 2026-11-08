# @hivefloor/schema

The single source of truth for Hivefloor's data contracts: Zod schemas, inferred types, constants (tool categories, event kinds) and the pure `layout` function shared by the CLI, the relay and the web app.

This is an internal workspace package (`type:shared`). Every other project may import it; it imports nothing from them.

> Status: placeholder. The schemas and `layout` arrive in M1. See [docs/PRD.md](../../docs/PRD.md#data-contracts).

## Develop

```bash
pnpm nx test schema       # unit tests with coverage (target: 95% lines)
pnpm nx typecheck schema
pnpm nx lint schema
pnpm nx build schema
```
