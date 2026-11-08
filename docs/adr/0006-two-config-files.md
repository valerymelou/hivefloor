# 0006. Keep two config files: public office, private machine

- Status: accepted
- Date: 2026-11-08
- Deciders: Valery Melou

## Context and problem statement

The relay needs to know the office's title, public projects and limits, and serves them to every visitor. The CLI needs the endpoint, the secret, local repo paths and category rules, which must never leave the machine. Should these live in one file or two?

## Decision drivers

- Nothing private (paths, secret, MCP server names) may ever be deployed or served.
- The relay's allowlists come from configuration, so the public part must be explicit.
- Forks must not inherit the maintainer's setup or conflict on merge (H16).

## Considered options

1. Two files: a public `office.config.json` deployed with the relay, and a private `~/.config/hivefloor/config.json` on the owner's machine, with the secret in a separate mode-600 file.
2. One file on the owner's machine, with the CLI pushing the public part to the relay.
3. Configuration stored in the Durable Object and edited through an admin page.

## Decision outcome

Chosen option: **two files**, because the split makes the privacy boundary physical: the public file contains only what visitors may see, and the private file never travels. Both are validated by Zod schemas in `packages/schema`, with generated JSON Schema for editor autocomplete. The repository ships `office.config.example.json`; the real `office.config.json` is git-ignored and deployed with `hivefloor deploy`. The secret is stored next to the machine config in a `secret` file with mode 600, never inside JSON.

### Consequences

- Good: impossible to deploy a repo path or the secret by accident.
- Good: no admin surface to secure on the relay.
- Bad: the two files can disagree on a project name; `hivefloor doctor` and `preview` detect and warn about it (H4).
- Bad: changing the public file needs a redeploy.

## More information

- PRD: Two config files, Data contracts, hardening rules H4 and H16.
