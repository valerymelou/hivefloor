# Contributing to Hivefloor

Thanks for your interest! Hivefloor aims to be a codebase a stranger can understand in an hour and contribute to in a day. This guide is a skeleton and grows with each milestone.

## Set up (5 minutes)

You need Node 22 or later and Git. pnpm comes through Corepack.

```bash
git clone https://github.com/valerymelou/hivefloor.git
cd hivefloor
corepack enable
pnpm install
```

`pnpm dev` starts the relay locally with `wrangler dev` (copy `apps/relay/.dev.vars.example` to `.dev.vars` first). The web app and demo simulator join it in M5.

## Everyday commands

| Command                                         | What it does                                           |
| ----------------------------------------------- | ------------------------------------------------------ |
| `pnpm nx affected -t lint typecheck test build` | Checks only the projects your change touches.          |
| `pnpm nx run-many -t lint typecheck test build` | Checks everything, as CI does on `main`.               |
| `pnpm nx graph`                                 | Shows how projects depend on each other.               |
| `pnpm nx bench cli`                             | Benchmarks the hook; CI gates the binary at p95 50 ms. |
| `pnpm nx compile cli`                           | Builds the standalone CLI binaries (needs Bun 1.4).    |
| `pnpm format`                                   | Formats the repository with Prettier.                  |
| `pnpm nx release plan`                          | Describes a change to a published package (see below). |

## Rules of the road

- **Privacy first.** Events are built field by field from the allowlist in `packages/schema`. Never spread or forward a hook payload. Read [docs/privacy.md](docs/privacy.md).
- **Module boundaries.** Apps and the CLI import only from `packages/schema`, never from each other. ESLint enforces this.
- **Pure core, thin edges.** Put logic in pure functions with unit tests; keep I/O, storage and rendering at the edges.
- **Strict TypeScript.** No `any`, no non-null assertions outside tests, exhaustive `switch` statements.
- **TSDoc on every export.** ESLint flags exported symbols without a doc comment.
- **No new runtime dependencies** without agreement in an issue first, and never in `packages/cli`.
- **Docs move with code.** A behaviour change updates `docs/`; a significant decision gets an ADR in `docs/adr/`.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/), for example `feat(cli): add doctor command`. Allowed scopes: `schema`, `cli`, `relay`, `web`, `web-e2e`, `site`, `docs`, `repo`, `ci`, `deps`, `deps-dev`, `release`. Dependabot's own `chore(deps…): Bump …` messages are exempt. A Git hook checks your messages locally, and CI checks them, and the pull request title too (it becomes the squash commit message, so keep the subject lower case: `feat(cli): add doctor command`).
- Fill in the pull request template, including the privacy impact section.
- CI runs lint, typecheck, test and build on the affected projects. Coverage targets: schema 95%, cli 90%, relay 85%, web core 80%.

## Version plans

Every change to a published package (today only `hivefloor`, the CLI) needs a version plan:

```bash
pnpm nx release plan
```

Pick the bump (patch, minor, major) and write one or two sentences for the changelog. The plan is a Markdown file in `.nx/version-plans/`; commit it with your change. CI fails a pull request that changes the CLI without one.

## Releasing (maintainers)

Releases are cut from `main` with Nx Release, which reads the version plans, bumps versions, writes `CHANGELOG.md` and tags `v<version>`:

```bash
pnpm nx release --skip-publish
pnpm nx release publish
```

The very first release needs `--first-release`. A `release.yml` workflow that publishes from CI with npm provenance arrives in M8.

## Reporting bugs and security issues

Open an issue with the bug template. For anything security or privacy related, follow [SECURITY.md](SECURITY.md) and report privately.

By contributing you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
