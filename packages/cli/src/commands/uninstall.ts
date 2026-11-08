import { rm } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { removeHooks } from '../core/settings.js';
import { claudeSettingsPath, readSettings, writeSettings } from '../edge/claude-settings.js';
import { hivefloorFiles } from '../edge/home.js';
import { say, type CommandIo } from './context.js';

/**
 * `hivefloor uninstall`: removes Hivefloor's hooks and nothing else from Claude
 * Code's settings, after a backup (C13). The config, secret and state stay unless
 * `--purge` is given.
 *
 * @param args - Arguments after `uninstall`.
 * @param io - Process facilities.
 * @returns The exit code.
 */
export async function uninstall(args: readonly string[], io: CommandIo): Promise<number> {
  const { values } = parseArgs({
    args: [...args],
    options: { purge: { type: 'boolean' }, settings: { type: 'string' } },
    strict: true,
  });
  const settingsPath = values.settings ?? claudeSettingsPath(io.env, io.home);
  const file = await readSettings(settingsPath);
  if (file.kind === 'invalid') {
    io.stderr(
      `hivefloor: ${settingsPath} can't be updated because ${file.reason}. Remove the hivefloor hooks by hand.\n`,
    );
    return 1;
  }
  const change = removeHooks(file.settings);
  if (change.events.length > 0) {
    const backup = await writeSettings(settingsPath, change.settings, file.kind === 'ok', io.now());
    say(
      io,
      `✓ Removed the Hivefloor hook from ${String(change.events.length)} events in ${settingsPath}${backup === undefined ? '' : ` (backup: ${backup})`}`,
    );
  } else {
    say(io, `No Hivefloor hooks in ${settingsPath}.`);
  }
  const files = hivefloorFiles(io.env, io.home, io.windows);
  if (values.purge === true) {
    await rm(files.dir, { recursive: true, force: true });
    say(io, `✓ Deleted ${files.dir} (config, secret and state).`);
  } else {
    say(io, `Kept ${files.dir}. Run hivefloor uninstall --purge to delete it too.`);
  }
  return 0;
}
