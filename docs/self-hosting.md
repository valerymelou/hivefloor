# Self-hosting

> Status: skeleton. This guide is written in M4 and finished in M8.

How to deploy your own office on Cloudflare's free plan in about 10 minutes and connect it with `npx hivefloor init`.

## Planned sections

- Requirements (a Cloudflare account on the free plan, Node, Claude Code)
- Deploy the relay and the office with `hivefloor deploy`
- Connect your machine with `hivefloor init`
- Mark projects public
- Protect `/ingest` with a rate-limiting rule
- What happens when the daily free-plan limit is reached
- Rotate the shared secret
- Sessions not on your machine (Claude Code on the web, CI) are not supported in v1
