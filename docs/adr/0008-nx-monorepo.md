# 0008. Use Nx on pnpm workspaces for the monorepo

- Status: accepted
- Date: 2026-11-08
- Deciders: Valery Melou

## Context and problem statement

Hivefloor is one TypeScript codebase with a shared contract package, a published CLI, a Cloudflare Worker, an Angular app, an Analog site and end-to-end tests. We need a workspace that keeps their boundaries honest, runs only what a change affects, and manages releases, without asking contributors for any account.

## Decision drivers

- First-class Angular support, including generators and migrations.
- Enforced module boundaries: apps and the CLI may depend only on `packages/schema`.
- Fast CI on the free GitHub Actions tier by running only affected projects.
- Versioned releases with changelogs for the published CLI.
- No hosted service required.

## Considered options

1. Nx on pnpm workspaces, with no Nx Cloud connection.
2. pnpm workspaces with Turborepo.
3. pnpm workspaces with plain scripts.

## Decision outcome

Chosen option: **Nx on pnpm workspaces, without Nx Cloud.** Nx provides Angular and JS generators, `nx affected`, the `@nx/enforce-module-boundaries` lint rule driven by project tags, and Nx Release with version plans. pnpm workspaces give strict, fast installs. The relay has no official Nx plugin, so its `project.json` wraps Wrangler and Vitest with `nx:run-commands`.

### Implementation choices made in M0

- **TypeScript path aliases, not project references.** Nx 24's default for new pnpm workspaces is a "TS solution" setup with project references, but `@nx/angular` 24 refuses to run its generators in that setup (Angular doesn't support project references). We therefore use the classic layout: `tsconfig.base.json` with `paths` (for example `@hivefloor/schema`), each project with its own `tsconfig.lib.json` and `tsconfig.spec.json`. pnpm workspaces still manage packages.
- **Explicit `typecheck` targets.** Without the TS solution setup, Nx doesn't infer `typecheck`, so a target default runs `tsc --noEmit` on each project's lib and spec configs.
- **Tags:** `type:shared` (schema), `scope:cli`, `scope:relay`, `scope:web`, `scope:site`, `type:e2e`. Every tag may depend only on `type:shared`.
- **Strict TypeScript** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`) and ESLint flat config with `typescript-eslint` strict and stylistic type-checked rules, exhaustive switches, and `jsdoc/require-jsdoc` on exported symbols.
- **Node packages are ESM with `NodeNext` resolution** (`schema` and `cli`), so built output runs on Node without a bundler.
- **Releases:** one fixed release group containing the CLI, version plans enabled, tags `v{version}`, a workspace `CHANGELOG.md` and GitHub releases. CI fails a pull request that changes a published package without a version plan (`nx release plan:check`).
- **Analytics and Nx Cloud are off** (`"analytics": false`, no `nxCloudId`).

### Consequences

- Good: one command checks exactly what a change affects; boundaries fail the lint step, not a code review.
- Good: Angular generators work as-is in M5.
- Bad: Nx is a large dev dependency with its own concepts (targets, inputs, plugins) for contributors to learn; `CONTRIBUTING.md` lists the few commands they need.
- Bad: path aliases mean TypeScript doesn't enforce boundaries by itself; ESLint does.

## More information

- PRD: Tech stack and monorepo layout, Engineering standards.
- [Nx: module boundaries](https://nx.dev/features/enforce-module-boundaries), [Nx Release version plans](https://nx.dev/recipes/nx-release/file-based-versioning-version-plans).
