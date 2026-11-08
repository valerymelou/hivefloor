## What and why

<!-- What does this change do, and why? Link the issue or milestone (for example "Closes #12" or "M1 · Schema"). -->

## How it was tested

<!-- Commands you ran, tests you added, what you checked by hand. -->

## Privacy impact

<!--
Does this change what leaves the owner's machine, what the relay stores or logs, or what visitors can see?
If yes: which fields, and confirm they are in the allowlist in packages/schema.
Any data-contract change must update packages/schema, docs/PRD.md and add an ADR in this PR.
-->

- [ ] No change to what is sent, stored, logged or shown
- [ ] Changes it, explained above, with tests

## Checklist

- [ ] `pnpm nx affected -t lint typecheck test build` passes locally
- [ ] Tests added or updated; coverage targets still met (schema 95, cli 90, relay 85, web core 80)
- [ ] TSDoc on every new or changed export
- [ ] Docs in `docs/` updated for any behaviour change
- [ ] Version plan added (`pnpm nx release plan`) if a published package changed
- [ ] ADR added in `docs/adr/` for a significant decision
- [ ] Screenshots attached for visual changes
- [ ] No new runtime dependency, or the maintainer agreed to it (never in `packages/cli`)
