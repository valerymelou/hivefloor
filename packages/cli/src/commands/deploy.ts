import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { isRecord } from '../core/payload.js';
import { say, type CommandIo } from './context.js';

/** Cloudflare's size limit for one Worker variable. */
export const MAX_VAR_BYTES = 5 * 1024;

/**
 * Finds Wrangler's JavaScript entry point from a Hivefloor checkout, so it can be
 * run with Node directly: no shell, so no quoting trouble on Windows.
 *
 * @param cwd - The checkout's root.
 * @returns The path to Wrangler's bin script, or `undefined` when not installed.
 */
export async function findWrangler(cwd: string): Promise<string | undefined> {
  try {
    const manifestPath = createRequire(join(cwd, 'package.json')).resolve('wrangler/package.json');
    const manifest: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
    const bin = isRecord(manifest) ? manifest['bin'] : undefined;
    const entry =
      typeof bin === 'string'
        ? bin
        : isRecord(bin) && typeof bin['wrangler'] === 'string'
          ? bin['wrangler']
          : undefined;
    return entry === undefined ? undefined : join(dirname(manifestPath), entry);
  } catch {
    return undefined;
  }
}

const options = {
  config: { type: 'string', default: 'office.config.json' },
  'wrangler-config': { type: 'string', default: join('apps', 'relay', 'wrangler.jsonc') },
  'dry-run': { type: 'boolean' },
} as const;

/**
 * `hivefloor deploy`: validates `office.config.json` and deploys the relay with
 * Wrangler, passing the validated config as the `OFFICE_CONFIG` variable (H16).
 * Run it from a Hivefloor checkout; the real config file stays out of git.
 *
 * @param args - Arguments after `deploy`.
 * @param io - Process facilities.
 * @returns Wrangler's exit code, or 1 when validation fails.
 */
export async function deploy(args: readonly string[], io: CommandIo): Promise<number> {
  const { values } = parseArgs({ args: [...args], options, strict: true });
  const configPath = resolve(io.cwd, values.config);
  let text: string;
  try {
    text = await readFile(configPath, 'utf8');
  } catch {
    io.stderr(
      `hivefloor: no ${configPath}. Copy office.config.example.json to office.config.json and edit it.\n`,
    );
    return 1;
  }
  const { checkOfficeConfig } = await import('../edge/validate-config.js');
  const checked = checkOfficeConfig(text);
  if (!checked.ok) {
    io.stderr(`hivefloor: ${configPath} is invalid:\n  ${checked.problems.join('\n  ')}\n`);
    return 1;
  }
  const json = JSON.stringify(checked.config);
  if (Buffer.byteLength(json) > MAX_VAR_BYTES) {
    io.stderr(
      `hivefloor: ${configPath} is too large for a Worker variable (${String(MAX_VAR_BYTES)} bytes). Shorten names or remove projects.\n`,
    );
    return 1;
  }
  const wranglerConfig = resolve(io.cwd, values['wrangler-config']);
  const wrangler = await findWrangler(io.cwd);
  if (!existsSync(wranglerConfig) || wrangler === undefined) {
    io.stderr(
      `hivefloor: run deploy from your Hivefloor checkout after pnpm install (looked for ${wranglerConfig} and Wrangler).\n`,
    );
    return 1;
  }
  say(
    io,
    `✓ ${configPath} is valid (${String(checked.config.publicProjects.length)} public projects).`,
  );
  const node = io.script !== undefined && /\.(c|m)?js$/.test(io.script) ? io.execPath : 'node';
  const code = await io.runProcess(node, [
    wrangler,
    'deploy',
    '--config',
    wranglerConfig,
    '--var',
    `OFFICE_CONFIG:${json}`,
    ...(values['dry-run'] === true ? ['--dry-run'] : []),
  ]);
  if (code === 0) {
    say(
      io,
      '',
      'Deployed. If the relay has no secret yet, set it once:',
      `  npx wrangler secret put HIVEFLOOR_SECRET --config ${wranglerConfig}`,
    );
  }
  return code;
}
