import { existsSync, realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { isRecord } from '../core/payload.js';
import { loadSecret } from '../edge/config.js';
import { writeAtomic } from '../edge/files.js';
import { hivefloorFiles } from '../edge/home.js';
import { say, type CommandIo } from './context.js';

/** Cloudflare's size limit for one Worker variable. */
export const MAX_VAR_BYTES = 5 * 1024;

/**
 * Finds the Wrangler installed in a Hivefloor checkout and returns its JavaScript
 * entry point, so it can be run with Node directly: no shell, so no quoting
 * trouble on Windows.
 *
 * @param cwd - The checkout's root.
 * @returns The path to Wrangler's bin script, or `undefined` when not installed.
 */
export async function findWrangler(cwd: string): Promise<string | undefined> {
  // pnpm installs Wrangler for the relay, not at the root of the checkout.
  for (const base of [cwd, join(cwd, 'apps', 'relay')]) {
    const found = await wranglerEntry(cwd, base);
    if (found !== undefined) return found;
  }
  return undefined;
}

async function wranglerEntry(cwd: string, base: string): Promise<string | undefined> {
  try {
    const manifestPath = createRequire(join(base, 'package.json')).resolve('wrangler/package.json');
    // Only the checkout's own Wrangler: never one found further up or globally.
    const inside = relative(realpathSync(cwd), realpathSync(manifestPath));
    if (inside.startsWith('..') || resolve(inside) === inside) return undefined;
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
  'push-secret': { type: 'boolean' },
} as const;

const NO_SECRET_HINT =
  'This machine has no secret, so the relay was left as it is. To create one and set it: hivefloor deploy --push-secret';

/**
 * Decides which secret, if any, to set on the relay. A machine with no secret
 * only creates one when told to, because that replaces whatever the relay has
 * and would disconnect any other machine; unattended runs (CI) never do.
 */
async function secretToPush(io: CommandIo, push: boolean): Promise<string | undefined> {
  const files = hivefloorFiles(io.env, io.home, io.windows);
  const existing = await loadSecret(files);
  if (existing !== undefined) return push ? existing : undefined;
  if (!push) {
    if (!io.interactive) return undefined;
    const answer = await io.ask(
      'Create a secret and set it on the relay? This replaces any secret it already has. [Y/n] ',
    );
    if (/^n/i.test(answer.trim())) return undefined;
  }
  const secret = io.randomSecret();
  await writeAtomic(files.secret, `${secret}\n`, 0o600);
  return secret;
}

/**
 * `hivefloor deploy`: validates `office.config.json` and deploys the relay with
 * Wrangler, passing the validated config as the `OFFICE_CONFIG` variable (H16).
 * On a machine with no secret it offers to create one and set it on the relay,
 * so `hivefloor init` afterwards just connects; `--push-secret` does so without
 * asking, and sets an existing secret too. The secret goes through stdin, never
 * the command line. Run it from a
 * Hivefloor checkout; the real config file stays out of git.
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
  if (code !== 0) return code;
  if (values['dry-run'] === true) {
    say(io, '', 'Dry run: nothing was deployed and no secret was set.');
    return 0;
  }
  const secret = await secretToPush(io, values['push-secret'] === true);
  if (secret === undefined) {
    const known = (await loadSecret(hivefloorFiles(io.env, io.home, io.windows))) !== undefined;
    say(io, '', known ? 'Deployed. Next: hivefloor init --url <your office URL>' : NO_SECRET_HINT);
    return 0;
  }
  const secretCode = await io.runProcess(
    node,
    [wrangler, 'secret', 'put', 'HIVEFLOOR_SECRET', '--config', wranglerConfig],
    secret,
  );
  if (secretCode !== 0) {
    io.stderr(
      `hivefloor: deployed, but setting the secret failed. Run: hivefloor deploy --push-secret\n`,
    );
    return secretCode;
  }
  say(io, '', '✓ Secret set on the relay.', 'Next: hivefloor init --url <your office URL>');
  return 0;
}
