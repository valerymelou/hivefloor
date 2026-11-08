---
__default__: minor
---

Add `hivefloor hook`: reads a Claude Code hook payload, builds a sanitized event (robot, kind, category, time, and for public projects the project name and goal) and sends it signed from a detached process. It always exits 0 and never prints. Goals come from the in-progress task or the session title. Includes `--record` for scrubbed payload fixtures and a standalone binary build.
