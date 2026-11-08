# Privacy

Hivefloor's promise: **the owner's machine decides what the office sees.** Every rule below is enforced in code and covered by tests as the milestones land; this page links to those tests once they exist.

## What leaves your machine

For a **private** project (any folder you haven't marked public), each event carries only:

- which robot (a salted 6-character hash, never the raw session ID),
- what kind of work (one of 12 fixed tool categories, such as `coding` or `testing`),
- when (rounded to 5 seconds by default).

All private sessions share one "Private projects" room, so not even the area of work is revealed. You can hide that room entirely.

For a project you mark **public**, events also carry the project's name and, optionally, Claude's current task title (the goal), capped at 60 characters and filtered for sensitive words.

## What never leaves your machine

File paths, commands, prompts, file contents, tool inputs and outputs, MCP server names and private project names.

## How it is enforced

- **Allowlist by construction.** The CLI builds each event field by field from the allowlist in `packages/schema`. It never copies or spreads a hook payload, so a new Claude Code field can't leak.
- **Two gates.** The relay re-validates every field against its own allowlists of roles, categories and public projects.
- **No raw identifiers.** IDs are hashed with a salt, so they can't be linked to local logs or across days.
- **No stored bodies.** The relay keeps only the current office state and today's counts, and never logs bodies or headers.
- **Text only.** Everything shown in the office is inserted as text, never as HTML, under a strict Content Security Policy.

Found a gap? Please report it privately, see [SECURITY.md](../SECURITY.md).
