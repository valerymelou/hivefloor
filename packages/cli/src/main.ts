import { appendFile } from 'node:fs/promises';
import { addProject } from './commands/add-project.js';
import { deploy } from './commands/deploy.js';
import { doctor } from './commands/doctor.js';
import { init } from './commands/init.js';
import { setPaused } from './commands/pause.js';
import { preview } from './commands/preview.js';
import type { CommandIo } from './commands/context.js';
import { uninstall } from './commands/uninstall.js';
import { loadConfig, loadSecret } from './edge/config.js';
import { runHook } from './edge/hook.js';
import { hivefloorFiles } from './edge/home.js';
import { sendEvent } from './edge/sender.js';
import { VERSION } from './version.js';

export { VERSION } from './version.js';

/** The process facilities `main` uses. */
export type MainIo = CommandIo;

const HELP = `hivefloor ${VERSION}: show your Claude Code sessions in a Hivefloor office

Usage:
  hivefloor init [--url URL] [--public NAME] [--rotate] [--secret-stdin]
                              Connect this machine to your office and register the hooks
  hivefloor add-project NAME [--path DIR] [--office-config FILE] [--color #RRGGBB] [--deploy]
                              Make a project public, here and in office.config.json
  hivefloor doctor           Check the setup and show exactly what leaves this machine
  hivefloor preview           Print the event a hook payload on stdin would send
  hivefloor pause | resume    Stop or restart sending
  hivefloor uninstall [--purge]
                              Remove the hooks (and with --purge, the config and secret)
  hivefloor deploy [--config FILE] [--dry-run]
                              Validate office.config.json and deploy the relay (from a checkout)
  hivefloor hook [--record]   Read one Claude Code hook payload from stdin (used by the hooks)
  hivefloor --version         Print the version

Docs: https://github.com/valerymelou/hivefloor
`;

type Command = (args: readonly string[], io: CommandIo) => Promise<number>;

const COMMANDS: ReadonlyMap<string, Command> = new Map<string, Command>([
  ['init', init],
  ['add-project', addProject],
  ['doctor', doctor],
  ['preview', preview],
  ['pause', (args, io) => setPaused(true, args, io)],
  ['resume', (args, io) => setPaused(false, args, io)],
  ['uninstall', uninstall],
  ['deploy', deploy],
]);

async function send(body: string | undefined, io: MainIo): Promise<void> {
  const files = hivefloorFiles(io.env, io.home, io.windows);
  const config = await loadConfig(files);
  const secret = await loadSecret(files);
  if (body === undefined || config === undefined || secret === undefined || config.paused) return;
  const status = await sendEvent(body, {
    endpoint: config.endpoint,
    secret,
    now: io.now,
    fetch: io.fetch,
  });
  if (io.env.HIVEFLOOR_DEBUG === '1') {
    await appendFile(
      files.debugLog,
      `${JSON.stringify({ at: new Date(io.now()).toISOString(), status: status ?? null })}\n`,
    );
  }
}

async function hook(rest: readonly string[], io: MainIo): Promise<number> {
  try {
    await runHook(await io.readStdin(), {
      files: hivefloorFiles(io.env, io.home, io.windows),
      paths: { home: io.home, windows: io.windows },
      now: io.now,
      launchSender: io.launchSender,
      record: rest.includes('--record'),
      debug: io.env.HIVEFLOOR_DEBUG === '1',
    });
  } catch {
    // The hook never fails: a broken hook must not affect Claude Code.
  }
  return 0;
}

/**
 * Runs the CLI.
 *
 * `hook` and `__send` always return 0 and write nothing to stdout, because
 * Claude Code adds the stdout of some hooks to Claude's context (C2). Other
 * commands report usage errors on stderr with exit code 2.
 *
 * @param args - Command-line arguments after the executable and script.
 * @param io - Process facilities.
 * @returns The exit code.
 */
export async function main(args: readonly string[], io: MainIo): Promise<number> {
  const [command, ...rest] = args;
  if (command === 'hook') return hook(rest, io);
  if (command === '__send') {
    try {
      await send(rest[0], io);
    } catch {
      // Every sending failure is silent (C9).
    }
    return 0;
  }
  if (command === '--version' || command === '-v') {
    io.stdout(`${VERSION}\n`);
    return 0;
  }
  if (command === undefined || command === 'help' || command === '--help' || command === '-h') {
    io.stdout(HELP);
    return 0;
  }
  const run = COMMANDS.get(command);
  if (run === undefined) {
    io.stderr(`hivefloor: unknown command "${command}"\n\n${HELP}`);
    return 2;
  }
  try {
    return await run(rest, io);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`hivefloor ${command}: ${message}\n`);
    return 2;
  }
}
