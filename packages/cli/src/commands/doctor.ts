import { readFile, stat } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import type { MachineConfig } from '@hivefloor/schema';
import { relayBase } from '../core/commands.js';
import { decide } from '../core/decide.js';
import {
  clockCheck,
  formatChecks,
  hooksCheck,
  ingestCheck,
  namesChecks,
  type Check,
} from '../core/doctor.js';
import { registeredHooks } from '../core/settings.js';
import { claudeSettingsPath, readSettings } from '../edge/claude-settings.js';
import { loadSecret } from '../edge/config.js';
import { writeAtomic } from '../edge/files.js';
import { hivefloorFiles, officeCacheFile, type HivefloorFiles } from '../edge/home.js';
import { sendEvent } from '../edge/sender.js';
import { say, type CommandIo } from './context.js';

const RELAY_TIMEOUT_MS = 5000;

async function configCheck(
  files: HivefloorFiles,
): Promise<{ check: Check; config?: MachineConfig }> {
  let text: string;
  try {
    text = await readFile(files.config, 'utf8');
  } catch {
    return {
      check: {
        status: 'fail',
        title: 'Config',
        detail: `No config at ${files.config}. Run hivefloor init.`,
      },
    };
  }
  const { checkMachineConfig } = await import('../edge/validate-config.js');
  const result = checkMachineConfig(text);
  if (!result.ok)
    return {
      check: {
        status: 'fail',
        title: 'Config',
        detail: `${files.config} is invalid: ${result.problems.join('; ')}`,
      },
    };
  return { check: { status: 'ok', title: 'Config', detail: files.config }, config: result.config };
}

async function secretCheck(
  files: HivefloorFiles,
  windows: boolean,
): Promise<{ check: Check; secret?: string }> {
  const secret = await loadSecret(files);
  if (secret === undefined)
    return {
      check: {
        status: 'fail',
        title: 'Secret',
        detail: `Missing ${files.secret}. Run hivefloor init.`,
      },
    };
  if (!windows && ((await stat(files.secret)).mode & 0o077) !== 0) {
    return {
      check: {
        status: 'warn',
        title: 'Secret',
        detail: `${files.secret} is readable by other users: chmod 600 it.`,
      },
      secret,
    };
  }
  return { check: { status: 'ok', title: 'Secret', detail: 'Present and private.' }, secret };
}

async function relayChecks(
  config: MachineConfig,
  files: HivefloorFiles,
  io: CommandIo,
): Promise<Check[]> {
  const url = `${relayBase(config.endpoint)}/api/config`;
  try {
    const response = await io.fetch(url, {
      signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
      redirect: 'error',
    });
    if (!response.ok)
      return [
        {
          status: 'fail',
          title: 'Relay',
          detail: `GET ${url} answered ${String(response.status)}.`,
        },
      ];
    const office: unknown = await response.json();
    await writeAtomic(officeCacheFile(files), JSON.stringify(office));
    return [
      { status: 'ok', title: 'Relay', detail: url },
      clockCheck(io.now(), response.headers.get('date')),
      ...namesChecks(config, office),
    ];
  } catch {
    return [{ status: 'fail', title: 'Relay', detail: `Could not reach ${url}.` }];
  }
}

function sampleEvent(
  config: MachineConfig,
  secret: string,
  io: CommandIo,
  hook: Record<string, unknown>,
): string | undefined {
  const { event } = decide({
    payload: { session_id: `hivefloor-doctor-${String(io.now())}`, cwd: io.cwd, ...hook },
    config,
    secret,
    now: Math.floor(io.now() / 1000),
    paths: { home: io.home, windows: io.windows },
  });
  return event === undefined ? undefined : JSON.stringify(event);
}

/**
 * `hivefloor doctor`: checks the config, secret, hook registration and relay;
 * compares public names and clocks with the relay (H4, H8); sends a signed test
 * event marked as a dry run; and prints exactly what leaves the machine (C10).
 *
 * @param args - Arguments after `doctor`.
 * @param io - Process facilities.
 * @returns 1 when any check failed, else 0.
 */
export async function doctor(args: readonly string[], io: CommandIo): Promise<number> {
  const { values } = parseArgs({
    args: [...args],
    options: { settings: { type: 'string' } },
    strict: true,
  });
  const files = hivefloorFiles(io.env, io.home, io.windows);
  const checks: Check[] = [];
  const { check: configResult, config } = await configCheck(files);
  checks.push(configResult);
  if (config?.paused === true)
    checks.push({ status: 'warn', title: 'Sending', detail: 'Paused. Run hivefloor resume.' });
  const { check: secretResult, secret } = await secretCheck(files, io.windows);
  checks.push(secretResult);

  const settingsPath = values.settings ?? claudeSettingsPath(io.env, io.home);
  const settings = await readSettings(settingsPath);
  checks.push(
    settings.kind === 'invalid'
      ? {
          status: 'fail',
          title: 'Claude Code hooks',
          detail: `${settingsPath} can't be read: ${settings.reason}.`,
        }
      : hooksCheck(registeredHooks(settings.settings)),
  );

  if (config !== undefined) {
    checks.push(...(await relayChecks(config, files, io)));
    if (secret !== undefined) {
      const body = sampleEvent(config, secret, io, { hook_event_name: 'SessionStart' });
      const status =
        body === undefined
          ? undefined
          : await sendEvent(body, {
              endpoint: config.endpoint,
              secret,
              now: io.now,
              fetch: io.fetch,
              dryRun: true,
            });
      checks.push(ingestCheck(status));
    }
  }
  say(io, formatChecks(checks));

  if (config !== undefined) {
    const example = sampleEvent(config, secret ?? 'example', io, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
    });
    say(
      io,
      '',
      `When Claude edits a file in ${io.cwd}, exactly this leaves your machine:`,
      example ?? '(nothing)',
    );
  }
  return checks.some((c) => c.status === 'fail') ? 1 : 0;
}
