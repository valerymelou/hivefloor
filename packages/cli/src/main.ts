import { appendFile } from 'node:fs/promises';
import packageJson from '../package.json' with { type: 'json' };
import { loadConfig, loadSecret } from './edge/config.js';
import { runHook } from './edge/hook.js';
import { hivefloorFiles, type HomeEnv } from './edge/home.js';
import { sendEvent } from './edge/sender.js';

/** The CLI's version, from its package.json. */
export const VERSION: string = packageJson.version;

const HELP = `hivefloor ${VERSION}: show your Claude Code sessions in a Hivefloor office

Usage:
  hivefloor hook [--record]   Read one Claude Code hook payload from stdin (used by hooks)
  hivefloor --version         Print the version

More commands (init, doctor, preview, pause, resume, uninstall) are coming.
Docs: https://github.com/valerymelou/hivefloor
`;

/** The process facilities `main` uses, injected for tests. */
export interface MainIo {
  readonly env: HomeEnv & { readonly HIVEFLOOR_DEBUG?: string | undefined };
  readonly home: string;
  readonly windows: boolean;
  /** Unix milliseconds. */
  readonly now: () => number;
  readonly readStdin: () => Promise<string>;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly launchSender: (body: string) => void;
  readonly fetch: typeof fetch;
}

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

/**
 * Runs the CLI.
 *
 * `hook` always returns 0 and writes nothing to stdout, because Claude Code adds
 * the stdout of some hooks to Claude's context (C2).
 *
 * @param args - Command-line arguments after the executable and script.
 * @param io - Process facilities.
 * @returns The exit code.
 */
export async function main(args: readonly string[], io: MainIo): Promise<number> {
  const [command, ...rest] = args;
  switch (command) {
    case 'hook':
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
    case '__send':
      try {
        await send(rest[0], io);
      } catch {
        // Every sending failure is silent (C9).
      }
      return 0;
    case '--version':
    case '-v':
      io.stdout(`${VERSION}\n`);
      return 0;
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      io.stdout(HELP);
      return 0;
    default:
      io.stderr(`hivefloor: unknown command "${command}"\n\n${HELP}`);
      return 1;
  }
}
