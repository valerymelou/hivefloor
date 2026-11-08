# Architecture decision records

We record significant decisions here in [MADR](https://adr.github.io/madr/) format. Copy [template.md](template.md), give it the next number, and open it with status `proposed` in the pull request that makes the decision.

| ADR                                              | Decision                                                                   | Status             |
| ------------------------------------------------ | -------------------------------------------------------------------------- | ------------------ |
| [0001](0001-cloudflare-durable-objects.md)       | Cloudflare Durable Objects for the relay                                   | accepted           |
| [0002](0002-allowlist-by-construction.md)        | Allowlist-by-construction privacy                                          | accepted           |
| [0003](0003-threejs-over-game-engine.md)         | Three.js over a game engine                                                | accepted           |
| [0004](0004-goals-from-task-list.md)             | Goals from Claude's task list                                              | superseded by 0010 |
| [0005](0005-one-robot-per-instance.md)           | One robot per Claude instance, with hot desks                              | accepted           |
| [0006](0006-two-config-files.md)                 | Two config files                                                           | accepted           |
| [0007](0007-elastic-office-layout.md)            | One room per project, laid out by a shared pure function                   | accepted           |
| [0008](0008-nx-monorepo.md)                      | Nx on pnpm workspaces for the monorepo                                     | accepted           |
| [0009](0009-v1-contract-details.md)              | Settle the v1 contract details left open by the PRD                        | accepted           |
| [0010](0010-goals-from-task-or-session-title.md) | Take goals from the in-progress task, or else the session title            | accepted           |
| [0011](0011-compiled-binary-with-bun.md)         | Compile the standalone CLI binary with Bun                                 | accepted           |
| [0012](0012-cli-setup-and-relay-handshake.md)    | CLI setup commands and their contract with the relay                       | accepted           |
| [0013](0013-relay-office-state.md)               | Keep the office in one Durable Object, with a pure reducer and diff writes | accepted           |
| [0014](0014-web-foundation.md)                   | Build the office web app on Angular, Ndop UI and one signal store          | accepted           |
