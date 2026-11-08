# 0016. One Worker for the site and office, and a CI release

- Status: accepted
- Date: 2026-11-08
- Deciders: Valery Melou

## Context and problem statement

M8 ships the project: a landing page and docs at hivefloor.valerymelou.com with the live office at `/office`, the first npm release, and a setup that a stranger can finish in 10 minutes. Self-hosters must not need any of the site.

## Decision drivers

- One Cloudflare Worker on the free plan.
- The docs have one source, the files in `docs/`.
- The Content Security Policy stays strict.
- Setup steps run in order, and a re-deploy can't break a working machine.
- The CLI has no runtime dependencies and publishes with provenance.

## Decision outcome

**Base path.** The relay strips an optional `BASE_PATH` before routing. The office is built with `baseHref: /office/` and already resolves its API, WebSocket and model URLs against the page's base URL. `apps/site/wrangler.jsonc` runs the same relay code with its own assets folder, built by `site:assemble`. Self-hosters keep `apps/relay/wrangler.jsonc` and serve the office at `/`.

**Embed mode.** `#embed` shows only the office and a live badge. The landing page frames `/office/#embed`, which `frame-ancestors 'self'` allows.

**Docs.** `sync-docs` copies the guides into the site's content folder, adding front matter and rewriting links. Mermaid diagrams link to GitHub instead, because drawing them would add a large script to every guide.

**Content Security Policy on the site.** Angular's pre-rendered pages carry two small inline scripts for hydration. `site:assemble` hashes exactly those into the site's policy. The office keeps its own policy with no exceptions. Each path gets one `_headers` rule, because Cloudflare combines every rule that matches.

**Secret.** `hivefloor deploy` offers to create the secret and set it on the relay through stdin, so `init` comes after it and just connects. It asks first because a new secret replaces the relay's and disconnects other machines. With no one to answer, as in CI, it changes nothing unless `--push-secret` is passed.

**Release.** A hand-started workflow runs Nx Release, rebuilds so the package carries the new version, attaches the standalone binaries, and publishes with npm trusted publishing and provenance, so no npm token is stored.

**Configuration reference.** It is generated from descriptions on the Zod schemas and checked for drift by a file-snapshot test, like the JSON Schema.

### Consequences

- Good: one source for the docs, one Worker, and no change to how self-hosters deploy.
- Good: no long-lived npm token.
- Bad: the inline script hashes must be recomputed on every build, which `site:assemble` does.
- Bad: Homebrew is deferred, since a tap needs its own repository.

## Alternatives considered

- **Removing hydration from the site.** It would avoid the inline scripts, but the page would re-render on load and the hero's office would load twice.
- **`'unsafe-inline'` on the site.** Simpler, but a much weaker policy.
- **Creating the secret on every deploy with none on the machine.** Fewest prompts, but CI or a second machine would silently disconnect the first.
