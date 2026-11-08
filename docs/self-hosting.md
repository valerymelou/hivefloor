# Self-hosting

Run your own office on Cloudflare's free plan, in about 10 minutes.

**You need:** Node 22 or later, Git, a free [Cloudflare account](https://dash.cloudflare.com/sign-up) and Claude Code.

## 1. Deploy your office

```bash
git clone https://github.com/valerymelou/hivefloor.git
cd hivefloor
corepack enable
pnpm install
cp office.config.example.json office.config.json
```

Open `office.config.json` and set your `owner`, your `timezone` and any `publicProjects`. Every field is in the [configuration reference](configuration-reference.md). The file stays out of git.

Build the office, sign in to Cloudflare, and deploy:

```bash
pnpm nx build web
pnpm --filter @hivefloor/relay exec wrangler login
npm install -g hivefloor
hivefloor deploy
```

`hivefloor deploy` validates your config, deploys the relay, and offers to create the shared secret and set it on the relay. Say yes on your first deploy. On later deploys, or on another machine, it leaves the secret alone. Add `--dry-run` to check everything without deploying.

Wrangler prints your office's URL, such as `https://hivefloor.your-name.workers.dev`.

If you don't want to install Node on the machine running Claude Code, [download the standalone binary](https://github.com/valerymelou/hivefloor/releases) and use it in place of `hivefloor`.

## 2. Connect your machine

```bash
hivefloor init --url https://hivefloor.your-name.workers.dev
hivefloor doctor
```

`init` writes `~/.config/hivefloor/config.json` and registers the Claude Code hooks. `doctor` checks the connection and shows exactly what leaves your machine. Fix anything it marks with `✗`; see [troubleshooting](troubleshooting.md).

Start a new Claude Code session and open your office's URL. A robot walks in. Every folder is private until you make it public.

To connect a second machine, copy `~/.config/hivefloor/secret` to it first, or pipe it in with `hivefloor init --url … --secret-stdin`.

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
pnpm dev
printf '%s' 'the same secret' | hivefloor init --url http://localhost:8787 --secret-stdin
```

Open http://localhost:8787. To try the office with no relay at all, open http://localhost:4200/#demo while `pnpm dev` runs.

## Protect `/ingest` from floods

The 2 KB body cap, signatures and viewer cap are built in. Cloudflare's free plan also includes one [rate limiting rule](https://developers.cloudflare.com/waf/rate-limiting-rules/). Rules belong to a zone, so this needs your office on a custom domain. Create one with these settings:

| Setting  | Value                      |
| -------- | -------------------------- |
| Match    | URI Path equals `/ingest`  |
| Requests | 100 per 10 seconds, per IP |
| Action   | Block                      |
| Duration | 10 seconds                 |

Apply it to `/ingest` only. A rate limit on `/api/*` or `/live` answers visitors with a 429, which the page reads as the daily limit and shows "Office closed".

## When the daily free-plan limit is reached

Once the Workers daily limit is used up, Cloudflare answers with a 429 or error 1027 and the Worker can't run. Claude Code isn't affected: the hook drops its events. Visitors see "Office closed until" the next 00:00 UTC, in your time zone, and the page checks every few minutes until the office is back. Above the viewer cap (`viewerCap`, 500 by default), visitors get a "Busy" view that updates every few minutes.

## Rotate the shared secret

```bash
hivefloor init --rotate
hivefloor deploy --push-secret
```

Other machines then need the new `~/.config/hivefloor/secret`.

## Uninstall

`hivefloor uninstall` removes the hooks from Claude Code; add `--purge` to delete your Hivefloor config and secret too. To remove the office, delete the `hivefloor` Worker in the Cloudflare dashboard.
