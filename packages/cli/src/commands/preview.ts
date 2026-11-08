import { parseArgs } from 'node:util';
import { decide } from '../core/decide.js';
import { isRecord, parsePayload, readArray, readString } from '../core/payload.js';
import { loadConfig, loadSecret } from '../edge/config.js';
import { readJson } from '../edge/files.js';
import { hivefloorFiles, officeCacheFile } from '../edge/home.js';
import { say, type CommandIo } from './context.js';

/**
 * `hivefloor preview`: reads a hook payload from stdin and prints the event the
 * hook would send for it, without sending it or changing any state (C11). Warns
 * when the event names a project the relay didn't know at the last
 * `hivefloor doctor` (H4).
 *
 * @param args - Arguments after `preview` (none are accepted).
 * @param io - Process facilities.
 * @returns The exit code.
 */
export async function preview(args: readonly string[], io: CommandIo): Promise<number> {
  parseArgs({ args: [...args], options: {}, strict: true });
  const files = hivefloorFiles(io.env, io.home, io.windows);
  const config = await loadConfig(files);
  if (config === undefined) {
    io.stderr(`hivefloor: no valid config at ${files.config}. Run hivefloor init first.\n`);
    return 1;
  }
  const payload = parsePayload(await io.readStdin());
  if (payload === undefined) {
    io.stderr('hivefloor: pipe one hook payload (a JSON object) into hivefloor preview.\n');
    return 1;
  }
  const secret = (await loadSecret(files)) ?? 'preview-without-a-secret';
  const { event } = decide({
    payload,
    config,
    secret,
    now: Math.floor(io.now() / 1000),
    paths: { home: io.home, windows: io.windows },
  });
  if (event === undefined) {
    say(
      io,
      `Nothing would be sent for ${readString(payload, 'hook_event_name') ?? 'this payload'}.`,
    );
    return 0;
  }
  say(io, 'This would leave your machine:', JSON.stringify(event, null, 2));
  if (config.paused) say(io, '! Sending is paused (hivefloor resume).');
  const office = await readJson(officeCacheFile(files));
  if (event.project !== undefined && isRecord(office)) {
    const known = readArray(office, 'publicProjects').some(
      (p) => isRecord(p) && p['name'] === event.project,
    );
    if (!known)
      say(
        io,
        `! The relay did not know "${event.project}" at the last hivefloor doctor, so it would reject this event.`,
      );
  }
  return 0;
}
