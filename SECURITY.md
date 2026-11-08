# Security policy

Hivefloor's core promise is that the owner's machine decides what the office sees. We take reports about privacy leaks as seriously as classic security bugs.

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through GitHub:

1. Go to [Security advisories](https://github.com/valerymelou/hivefloor/security/advisories/new).
2. Describe the issue, how to reproduce it and its impact.

You can expect an acknowledgement within 3 working days and a first assessment within 7. We will keep you informed while we work on a fix, agree on a disclosure date with you, and credit you in the advisory unless you prefer otherwise.

## What counts

Examples of issues we want to hear about:

- Any field or value leaving the owner's machine that is not in the allowlist in `packages/schema`.
- A way to get a private project's name, a file path, a command, a prompt or file contents onto the office page.
- Bypassing the relay's signature, timestamp, replay or allowlist checks.
- Script injection through goal text, project names or any other field shown in the office.
- A hook payload that makes `hivefloor hook` print to stdout, fail to exit 0 or block Claude Code.
- Request bodies or headers ending up in Worker logs or Durable Object storage.

Out of scope: denial of service that only uses up the owner's own Cloudflare free plan quota (documented in the self-hosting guide), and issues in third-party dependencies that are already public.

## Supported versions

Until 1.0, only the latest published version of the `hivefloor` CLI and the latest commit on `main` receive security fixes.
