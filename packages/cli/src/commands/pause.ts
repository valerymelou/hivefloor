import { parseArgs } from 'node:util';
import { hivefloorFiles } from '../edge/home.js';
import { readRawConfig, writeRawConfig } from '../edge/machine-file.js';
import { say, type CommandIo } from './context.js';

/**
 * `hivefloor pause` and `hivefloor resume`: stop and restart sending without
 * uninstalling (C12), by setting `paused` in the machine config.
 *
 * @param paused - `true` for pause, `false` for resume.
 * @param args - Arguments after the command (none are accepted).
 * @param io - Process facilities.
 * @returns The exit code.
 */
export async function setPaused(
  paused: boolean,
  args: readonly string[],
  io: CommandIo,
): Promise<number> {
  parseArgs({ args: [...args], options: {}, strict: true });
  const files = hivefloorFiles(io.env, io.home, io.windows);
  const raw = await readRawConfig(files);
  if (raw === undefined || raw === null) {
    io.stderr(`hivefloor: no valid config at ${files.config}. Run hivefloor init first.\n`);
    return 1;
  }
  if ((raw['paused'] === true) !== paused) {
    const written = await writeRawConfig(files, { ...raw, paused });
    if (!written.ok) {
      io.stderr(`hivefloor: ${files.config} is invalid:\n  ${written.problems.join('\n  ')}\n`);
      return 1;
    }
  }
  say(
    io,
    paused
      ? 'Paused: nothing is sent until you run hivefloor resume.'
      : 'Resumed: your office sees your sessions again.',
  );
  return 0;
}
