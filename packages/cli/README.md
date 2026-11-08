# hivefloor

The command-line tool that connects Claude Code to your Hivefloor office: a live 3D view of your sessions as robots.

> Status: placeholder release to reserve the name. Commands (`init`, `hook`, `doctor`, `preview`, `pause`, `resume`, `uninstall`) arrive in the next milestones. Follow progress at https://github.com/valerymelou/hivefloor.

The CLI has **zero runtime dependencies** and only ever sends fields from the allowlist in `@hivefloor/schema`.

## Develop

```bash
pnpm nx test cli          # unit tests with coverage (target: 90% lines)
pnpm nx typecheck cli
pnpm nx lint cli
pnpm nx build cli
```

## Licence

MIT
