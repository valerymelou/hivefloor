# 0002. Build events by construction from an allowlist

- Status: accepted
- Date: 2026-11-08
- Deciders: Valery Melou

## Context and problem statement

Claude Code hook payloads contain file paths, commands, prompts, tool inputs and outputs, and they gain new fields over time. Hivefloor publishes activity to a public web page, so a single leaked field could expose a client's code or a private project's name. How do we guarantee that only intended facts leave the owner's machine?

## Decision drivers

- Privacy is the product's core promise; a leak is the worst possible bug.
- Claude Code will add payload fields we can't predict.
- The guarantee must be testable, not just documented.
- A compromised or buggy client must not be able to put new names on the page.

## Considered options

1. **Allowlist by construction:** build every outgoing event field by field from a schema, never copying input objects.
2. **Denylist:** forward the payload but strip known-sensitive fields.
3. **Redaction:** forward everything with pattern-based scrubbing of paths and secrets.

## Decision outcome

Chosen option: **allowlist by construction, checked twice.** The CLI creates a new event object containing only fields defined in `packages/schema`, each derived explicitly from the payload; it never spreads or forwards a payload object. The relay then re-validates every field against its own allowlists (roles, categories, public projects) before it touches state.

### Consequences

- Good: a new payload field cannot leak, because nothing copies unknown fields.
- Good: the rule is testable with property-based tests: random payloads never produce keys or values outside the schema.
- Good: the second gate limits what a stolen secret can do to known names only.
- Bad: each new piece of information needs a deliberate schema change, a PRD update and an ADR. That friction is intended.
- Rule for contributors: never `...payload`, `Object.assign` from a payload, or forward request bodies. Code review enforces it, and the property-based tests catch a slip.

## More information

- PRD: Privacy and security, threat model; CLI requirements C3–C6; relay requirement R1.
- [docs/privacy.md](../privacy.md).
