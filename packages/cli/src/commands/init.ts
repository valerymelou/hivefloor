import { basename } from 'node:path';
import { parseArgs } from 'node:util';
import { isEndpointUrl } from '@hivefloor/schema';
import { endpointFromOfficeUrl, hookCommand } from '../core/commands.js';
import { addHooks } from '../core/settings.js';
import { loadSecret } from '../edge/config.js';
import { writeAtomic } from '../edge/files.js';
import { claudeSettingsPath, readSettings, writeSettings } from '../edge/claude-settings.js';
import { hivefloorFiles } from '../edge/home.js';
import {
  MACHINE_SCHEMA_URL,
  readRawConfig,
  writeRawConfig,
  type RawConfig,
} from '../edge/machine-file.js';
import { VERSION } from '../version.js';
import { say, type CommandIo } from './context.js';

const options = {
  url: { type: 'string' },
  'secret-stdin': { type: 'boolean' },
  rotate: { type: 'boolean' },
  public: { type: 'string' },
  command: { type: 'string' },
  settings: { type: 'string' },
} as const;

async function chooseEndpoint(
  io: CommandIo,
  flag: string | undefined,
  current: unknown,
): Promise<string | undefined> {
  const existing = typeof current === 'string' ? current : undefined;
  let answer = flag;
  if (answer === undefined && io.interactive) {
    const hint = existing === undefined ? '' : ` [${existing.replace(/\/ingest$/, '')}]`;
    answer = (await io.ask(`Office URL${hint}: `)).trim() || existing;
  }
  answer ??= existing;
  const endpoint = answer === undefined ? undefined : endpointFromOfficeUrl(answer);
  return endpoint !== undefined && isEndpointUrl(endpoint) ? endpoint : undefined;
}

async function chooseSecret(
  io: CommandIo,
  fromStdin: boolean,
  existing: string | undefined,
  rotate: boolean,
): Promise<{ secret: string; created: boolean } | undefined> {
  if (existing !== undefined && !rotate) return { secret: existing, created: false };
  if (fromStdin) {
    const secret = (await io.readStdin()).trim();
    return secret.length >= 16 ? { secret, created: false } : undefined;
  }
  if (io.interactive && !rotate) {
    const pasted = (await io.ask('Paste the office secret, or press Enter to create one: ')).trim();
    if (pasted.length > 0)
      return pasted.length >= 16 ? { secret: pasted, created: false } : undefined;
  }
  return { secret: io.randomSecret(), created: true };
}

async function choosePublic(
  io: CommandIo,
  flag: string | undefined,
  projects: readonly unknown[],
): Promise<RawConfig | undefined> {
  if (flag !== undefined) return { path: io.cwd, public: true, name: flag };
  const known = projects.some(
    (p) => typeof p === 'object' && p !== null && (p as RawConfig)['path'] === io.cwd,
  );
  if (!io.interactive || known) return undefined;
  const yes = (await io.ask(`Show ${io.cwd} in the office as a public project? [y/N] `))
    .trim()
    .toLowerCase();
  if (yes !== 'y' && yes !== 'yes') return undefined;
  const name =
    (await io.ask(`Its name in office.config.json [${basename(io.cwd)}]: `)).trim() ||
    basename(io.cwd);
  return { path: io.cwd, public: true, name };
}

/**
 * `hivefloor init`: asks for the office URL, creates or accepts the shared
 * secret, writes the machine config and registers the hooks in Claude Code's
 * settings (C1). Idempotent: a second run with the same answers changes nothing.
 * Backs up `settings.json` before changing it and never touches other hooks.
 *
 * @param args - Arguments after `init`.
 * @param io - Process facilities.
 * @returns The exit code.
 */
export async function init(args: readonly string[], io: CommandIo): Promise<number> {
  const { values } = parseArgs({ args: [...args], options, strict: true });
  const files = hivefloorFiles(io.env, io.home, io.windows);
  const raw = await readRawConfig(files);
  if (raw === null) {
    io.stderr(
      `hivefloor: ${files.config} is not a JSON object. Fix or delete it, then run init again.\n`,
    );
    return 1;
  }
  const current = raw ?? {};

  const endpoint = await chooseEndpoint(io, values.url, current['endpoint']);
  if (endpoint === undefined) {
    io.stderr(
      'hivefloor: give the office URL with --url, for example --url https://office.example.com (https, or http only for localhost).\n',
    );
    return 1;
  }
  const secret = await chooseSecret(
    io,
    values['secret-stdin'] === true,
    await loadSecret(files),
    values.rotate === true,
  );
  if (secret === undefined) {
    io.stderr('hivefloor: the secret must be at least 16 characters.\n');
    return 1;
  }

  const listed: unknown = current['projects'];
  const projects: readonly unknown[] = Array.isArray(listed) ? listed : [];
  const added = await choosePublic(io, values.public, projects);
  const next: RawConfig = {
    $schema: MACHINE_SCHEMA_URL,
    v: 1,
    ...current,
    endpoint,
    ...(added === undefined
      ? {}
      : { projects: [...projects.filter((p) => (p as RawConfig)['path'] !== io.cwd), added] }),
  };
  const changes: string[] = [];
  if (JSON.stringify(next) !== JSON.stringify(raw)) {
    const written = await writeRawConfig(files, next);
    if (!written.ok) {
      io.stderr(`hivefloor: the config would be invalid:\n  ${written.problems.join('\n  ')}\n`);
      return 1;
    }
    changes.push(`Wrote ${files.config}`);
  }
  if (secret.created || (await loadSecret(files)) !== secret.secret) {
    await writeAtomic(files.secret, `${secret.secret}\n`, 0o600);
    changes.push(`Wrote ${files.secret} (mode 600)`);
  }

  const settingsPath = values.settings ?? claudeSettingsPath(io.env, io.home);
  const settingsFile = await readSettings(settingsPath);
  if (settingsFile.kind === 'invalid') {
    io.stderr(
      `hivefloor: ${settingsPath} can't be updated because ${settingsFile.reason}. Fix it, then run init again.\n`,
    );
    return 1;
  }
  const command =
    values.command === undefined
      ? hookCommand({
          execPath: io.execPath,
          script: io.script,
          version: VERSION,
          windows: io.windows,
        })
      : { command: values.command };
  const change = addHooks(settingsFile.settings, command.command);
  if (change.events.length > 0) {
    const backup = await writeSettings(
      settingsPath,
      change.settings,
      settingsFile.kind === 'ok',
      io.now(),
    );
    changes.push(
      `Registered the hook for ${String(change.events.length)} events in ${settingsPath}${backup === undefined ? '' : ` (backup: ${backup})`}`,
    );
  }

  if (changes.length === 0) say(io, 'Nothing to change: Hivefloor is already set up.');
  else say(io, ...changes.map((line) => `✓ ${line}`));
  if (command.warning !== undefined) say(io, `! ${command.warning}`);
  if (secret.created) {
    say(
      io,
      '',
      'New secret created. Set the same value on your relay (it is shown only now):',
      `  ${secret.secret}`,
      '  npx wrangler secret put HIVEFLOOR_SECRET --config apps/relay/wrangler.jsonc',
    );
  }
  say(
    io,
    '',
    'Next: hivefloor doctor checks the connection and shows exactly what leaves this machine.',
  );
  return 0;
}
