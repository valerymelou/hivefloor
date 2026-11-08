# Hivefloor

A self-hostable 3D office that shows your Claude Code sessions live. Each session is an animated robot at a desk, in a room for its project, using the kind of tool it is using right now. Subagents walk in, work and leave. It runs entirely on Cloudflare's free plan.

> **Status:** early development. The foundations are in place; the CLI, relay and office arrive milestone by milestone (see [the build plan](docs/PRD.md#build-plan-for-claude-code)). Nothing is usable yet.

## Privacy promise

Your machine decides what the office sees. Private projects send three facts per event: which robot, what kind of work, and when. File paths, commands, prompts, file contents and private project names never leave your machine. Read more in [docs/privacy.md](docs/privacy.md).

## Repository

| Path              | What                                                                  |
| ----------------- | --------------------------------------------------------------------- |
| `packages/schema` | The contract: schemas, types, constants and the room layout function. |
| `packages/cli`    | The `hivefloor` CLI and the Claude Code hook (published to npm).      |
| `apps/relay`      | Cloudflare Worker and Office Durable Object (from M4).                |
| `apps/web`        | The Angular office app (from M5).                                     |
| `apps/site`       | Landing page and docs for hivefloor.valerymelou.com (M8).             |
| `docs/`           | Guides, the product requirements and architecture decision records.   |

## Develop

Requires Node 22 or later and pnpm (via Corepack).

```bash
corepack enable
pnpm install
pnpm nx run-many -t lint typecheck test build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and conventions.

## Licence

[MIT](LICENSE). Hivefloor is an independent project and is not affiliated with or endorsed by Anthropic. "Claude" is used only to describe what a robot represents.
