# 0009. Settle the v1 contract details left open by the PRD

- Status: accepted
- Date: 2026-11-08
- Deciders: Valery Melou

## Context and problem statement

Writing the Zod schemas in M1 surfaced details the PRD left implicit: the ingest example omitted the required `seq`, robot statuses were only implied by the presence rules, the office states of `status` messages were not listed, and the relation between `aid`, `role` and `kind` was not stated. The relay and the CLI need one answer before M2 and M4.

## Decision drivers

- Privacy: reject anything not explicitly allowed.
- One unambiguous answer for the CLI, the relay and the web app.
- Additive changes only within v1.

## Decision outcome

- **Strict objects.** Every contract object rejects unknown keys. For ingest events this is the relay's first gate; the field list is exported as `INGEST_EVENT_FIELDS`.
- **`seq` in every ingest event** (H5), as the field table already required; the PRD examples now include it.
- **Event rules:** `cat` exactly when `kind` is `tool`; `goal` only with `project`; no `aid` means role `claude`, an `aid` means any other role; `spawn` and `done` need `aid`; `start` and `end` never have it.
- **Text:** names are 1–40 characters, goals 1–60; neither may contain control characters, and goals may not contain anything link-like. The CLI strips these before sending; the schema rejects them if they slip through.
- **Robot statuses:** `working`, `thinking`, `idle`, `away`. **Office states:** `open`, `busy`, `limited`.
- **Robot shape:** a main session (key `sid`) has a `desk` and no `parent`; a subagent (key `sid:aid`) has a `parent`, which prefixes its key, and a `seat`.
- **Room ids** are slugs of project names. `private` and `other` are reserved; project names must be unique ignoring case and must not share a slug (H15).
- **Config validation:** `idleAfterSec < awayAfterSec`; `roomsPerFloor` is even; the ingest endpoint must be `https` except on localhost.
- **JSON Schema** for both config files is generated from the Zod source with `z.toJSONSchema` (input shape, so defaulted fields are optional) and committed as `packages/schema/office.schema.json` and `machine.schema.json`. A test fails when they drift; `pnpm nx run schema:json-schema` regenerates them.

### Consequences

- Good: the relay can validate with `IngestEventSchema.safeParse` and map failures to a status code in one place.
- Good: editors autocomplete both config files.
- Bad: refinements (unique names, time zones, endpoint rules) are not expressible in JSON Schema, so editors don't flag them; loading the file does.

## More information

- PRD: Data contracts (updated in the same pull request), hardening rules H5 and H15.
- Code: `packages/schema/src/`.
