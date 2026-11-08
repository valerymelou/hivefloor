# Claude Code hooks

> Status: skeleton. This guide is written in M2 and M3.

Which Claude Code hook events `hivefloor init` registers, how they are registered (`"async": true`, so Claude Code never waits), what each one is used for, and how `init` and `uninstall` merge and remove only Hivefloor's own entries in `~/.claude/settings.json`.
