# 0011. Compile the standalone CLI binary with Bun

- Status: accepted
- Date: 2026-11-08
- Deciders: Valery Melou

## Context and problem statement

Claude Code runs `hivefloor hook` as a new process for every hook event. Starting Node costs 25–40 ms before any of our code runs, and some owners install Claude Code without Node at all (H1). The PRD asks for a single compiled binary for macOS, Linux and Windows, built with "Bun compile or Node single-executable", and for hook overhead under 50 ms at p95.

## Decision drivers

- Fast start for a process launched on every tool call.
- One CI runner should build every platform's binary.
- No runtime dependency added to the CLI package.

## Considered options

1. **`bun build --compile`** on the bundled `bin.mjs`.
2. Node single-executable applications (`node --build-sea`, also wrapped by tsdown's `exe` option), which need Node 25.5 or later to build and a Node binary per target platform.

## Decision outcome

Chosen option: **Bun**, because it cross-compiles all five targets (`linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `windows-x64`) from one runner and starts much faster. Measured on an Apple M-series laptop with the same bundle and payloads: the compiled binary's hook p95 was 19 ms, Node's 44 ms (bare `node -e ""` alone was 33 ms).

- tsdown still produces the npm package: one ESM `bin.mjs` for Node 20 or later, with `@hivefloor/schema` and Zod bundled in, so the package has no dependencies.
- `pnpm nx run cli:compile` runs `bun build --compile` on that bundle for each target; Bun is installed in CI with `oven-sh/setup-bun` (pinned version) and is never a dependency of any package.
- CI gates the binary's hook p95 at 50 ms and guards the Node bundle against regressions with a looser budget.
- Binaries are published to GitHub Releases (and Homebrew) in M8.

### Consequences

- Good: owners without Node get a fast hook; owners with Node can still use `npx hivefloor`.
- Bad: the binary embeds the Bun runtime (about 90 MB uncompressed).
- Bad: the hook must behave the same under Bun and Node. Only `node:` built-ins and `fetch` are used, and the integration test runs the real bundle; CI smoke-tests the Linux binary.

## More information

- Code: `packages/cli/scripts/compile.mjs`, `packages/cli/scripts/bench-hook.mjs`, `.github/workflows/ci.yml` (`cli-binary` job).
- PRD: CLI requirement C14, hardening rule H1.
