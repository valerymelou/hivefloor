# Troubleshooting

Start with:

```bash
hivefloor doctor
```

It checks your config, secret, Claude Code hooks and relay, compares your public project names and your clock with the relay's, sends a signed test event that the relay checks without changing the office, and prints exactly what leaves your machine. Each line is `✓` (fine), `!` (worth fixing) or `✗` (broken), with what to do.

## Common problems

| Doctor says                                     | What it means and what to do                                                                                                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `✗ Config: No config`                           | Run `hivefloor init`.                                                                                                                                                                                                                       |
| `✗ Config: … is invalid`                        | The message names the field. Fix it in `~/.config/hivefloor/config.json`; see [configuration](configuration.md).                                                                                                                            |
| `! Secret: … readable by other users`           | `chmod 600 ~/.config/hivefloor/secret`.                                                                                                                                                                                                     |
| `✗ Claude Code hooks: Not registered`           | Run `hivefloor init`. If you edited `~/.claude/settings.json` by hand, run it again: it repairs Hivefloor's hooks and leaves yours alone.                                                                                                   |
| `✗ Claude Code hooks: Not registered` on 0.1.0  | `npm install -g` at 0.1.0 registered a broken command. Run `npm install -g hivefloor@latest`, then `hivefloor init`.                                                                                                                        |
| `✗ Relay: Could not reach …`                    | Check the office URL (`hivefloor init --url …`) and that the relay is deployed.                                                                                                                                                             |
| `✗ Public projects: Not in the relay's …`       | The name in your machine config must match a `publicProjects[].name` in the relay's `office.config.json` exactly. Run `hivefloor add-project "Name" --office-config PATH --deploy` to add it and redeploy, or fix one of them by hand (H4). |
| `! Clock: Your clock is … s ahead/behind`       | Sync your system clock. Beyond 60 s the relay rejects every event (H8).                                                                                                                                                                     |
| `✗ Signed test event: … rejected the signature` | The secrets differ. Run `hivefloor init --rotate`, then `hivefloor deploy --push-secret` from your Hivefloor checkout.                                                                                                                      |
| `! Signed test event: … daily limit`            | Cloudflare's free plan limit is reached; the office resumes after the daily reset.                                                                                                                                                          |

## The robot never appears

1. Run `hivefloor doctor` and fix anything marked `✗`.
2. Check that you are not paused: `hivefloor resume`.
3. Pipe a payload into `hivefloor preview` to see what a hook would send. For example:

   ```bash
   echo '{"hook_event_name":"SessionStart","session_id":"test","cwd":"'"$PWD"'"}' | hivefloor preview
   ```

4. Set `HIVEFLOOR_DEBUG=1` before starting Claude Code: each hook call then appends the sanitized event (never the payload) to `~/.config/hivefloor/debug.log`, and each send its HTTP status.

## A public project shows up as private

The folder Claude Code runs in must be inside a `projects[].path` marked `"public": true`; the longest matching path wins. Run `hivefloor add-project "Name"` from the project folder to add it.

## The office says "Office closed"

Cloudflare's free daily limit is used up, so the Worker can't run until the reset at 00:00 UTC. Claude Code isn't affected. The page checks every few minutes and comes back by itself. If it happens often, see [rate limiting](self-hosting.md#protect-ingest-from-floods).

## The office is blank or shows only the list

The list view is the default when the browser can't draw WebGL. Turn on hardware acceleration, or try another browser. Without a GPU the office draws with fewer effects to stay usable.

## Not supported in v1

Sessions that don't run on your machine, such as Claude Code on the web or in CI, can't send events: the hook and its secret live on your machine (H10). Never commit the secret to a repository.
