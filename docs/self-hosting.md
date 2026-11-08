# Self-hosting

> Status: draft. The relay arrives in M4 and the web app in M5; this guide is finished in M8, with timings for the 10-minute setup.

## 1. Deploy your office

From a clone of this repository, after `pnpm install`:

```bash
cp office.config.example.json office.config.json   # then edit it: title, owner, public projects
npx hivefloor deploy
npx wrangler secret put HIVEFLOOR_SECRET --config apps/relay/wrangler.jsonc
```

`hivefloor deploy` validates `office.config.json` and deploys the relay with it (as the `OFFICE_CONFIG` variable). Your `office.config.json` stays out of git. Add `--dry-run` to check everything without deploying.

## 2. Connect your machine

```bash
npm install -g hivefloor      # or download the standalone binary
hivefloor init --url https://your-office.example.com
```

`init` writes `~/.config/hivefloor/config.json`, creates a secret (shown once: use it for `wrangler secret put` above, or paste the relay's secret instead), and registers the Claude Code hooks. Every folder stays private until you make it public.

## 3. Make a project public

A public project's name has to be in two places that match exactly: your machine config, and the relay's allowlist in `office.config.json`. The relay rejects any name it doesn't know. `add-project` updates both:

```bash
cd ~/code/ledgerly
hivefloor add-project "Ledgerly" --office-config ~/code/hivefloor/office.config.json --color "#f2a65a"
```

Then run `hivefloor deploy` from your Hivefloor checkout, or add `--deploy` to do it in the same step. Running from the checkout instead? Use `--path ~/code/ledgerly` and the `office.config.json` in the current folder is found for you.

If it can't find `office.config.json`, it still updates your machine config and prints the exact entry to add to `publicProjects` on the relay. It changes nothing when run again with the same arguments.

**Anyone viewing the office can see a public project's name and its task titles.** Keep a project private if either would give away something you don't want to share. See [privacy](privacy.md).

## Try it locally

You don't need a Cloudflare account to try the relay:

```bash
cp apps/relay/.dev.vars.example apps/relay/.dev.vars   # then set HIVEFLOOR_SECRET
pnpm nx dev relay
hivefloor init --url http://localhost:8787 --secret-stdin < your-secret-file
```

## 3. Check

```bash
hivefloor doctor
```

## Planned sections

- Protect `/ingest` with Cloudflare's free rate-limiting rule
- What happens when the daily free-plan limit is reached
- Rotate the shared secret (`hivefloor init --rotate`)
- Uninstall (`hivefloor uninstall`, `--purge`)
