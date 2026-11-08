# Configuration

> Status: skeleton. This guide is written in M1 (generated from the schemas in M8).

Hivefloor uses two config files on purpose:

- `office.config.json` is public and describes the office (title, owner, public projects and their colours, layout limits). The repository ships `office.config.example.json`; your real copy is git-ignored.
- `~/.config/hivefloor/config.json` lives only on your machine (endpoint, repo paths, which repos are public, category rules). It is never committed or uploaded. The shared secret sits next to it in a `secret` file with mode 600.

The field reference is generated from the Zod schemas in `packages/schema` so it never drifts.
