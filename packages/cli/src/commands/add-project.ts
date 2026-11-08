import { readFile, realpath, stat } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { quoteArg } from '../core/commands.js';
import {
  upsertMachineProject,
  upsertOfficeProject,
  type ProjectChange,
  type PublicEntry,
} from '../core/public-project.js';
import { writeAtomic } from '../edge/files.js';
import { hivefloorFiles } from '../edge/home.js';
import { readRawConfig, writeRawConfig, type RawConfig } from '../edge/machine-file.js';
import { say, type CommandIo } from './context.js';
import { deploy, MAX_VAR_BYTES } from './deploy.js';

const OFFICE_FILE = 'office.config.json';
const USAGE =
  'Usage: hivefloor add-project NAME [--path DIR] [--office-config FILE] [--color #RRGGBB] [--deploy]\n';

const options = {
  path: { type: 'string' },
  'office-config': { type: 'string' },
  color: { type: 'string' },
  deploy: { type: 'boolean' },
} as const;

/** What can be done with `office.config.json`, worked out before anything is written. */
type OfficePlan =
  | { readonly kind: 'absent' }
  | { readonly kind: 'failed'; readonly message: string }
  | {
      readonly kind: 'ready';
      readonly path: string;
      readonly change: ProjectChange;
      readonly text: string;
    };

function invalidOffice(path: string, problems: readonly string[]): OfficePlan {
  return { kind: 'failed', message: `${path} is invalid:\n  ${problems.join('\n  ')}` };
}

async function planOffice(
  flag: string | undefined,
  entry: PublicEntry,
  io: CommandIo,
): Promise<OfficePlan> {
  const path = resolve(io.cwd, flag ?? OFFICE_FILE);
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return flag === undefined
      ? { kind: 'absent' }
      : { kind: 'failed', message: `no ${path}. Check the path given to --office-config.` };
  }
  const { checkOfficeConfig } = await import('../edge/validate-config.js');
  const current = checkOfficeConfig(text);
  if (!current.ok) return invalidOffice(path, current.problems);

  // Change the file as the owner wrote it, without the defaults validation adds.
  const raw = JSON.parse(text) as RawConfig;
  const listed: unknown = raw['publicProjects'];
  const upsert = upsertOfficeProject(Array.isArray(listed) ? listed : [], entry);
  if (upsert.kind === 'conflict') {
    return {
      kind: 'failed',
      message: `${path} already lists "${upsert.existing}", and names can't differ only by case. Use that exact name, or rename it there first.`,
    };
  }
  if (upsert.change === 'unchanged') return { kind: 'ready', path, change: 'unchanged', text };

  const nextText = `${JSON.stringify({ ...raw, publicProjects: upsert.projects }, null, 2)}\n`;
  const next = checkOfficeConfig(nextText);
  if (!next.ok) return invalidOffice(path, next.problems);
  if (Buffer.byteLength(JSON.stringify(next.config)) > MAX_VAR_BYTES) {
    return {
      kind: 'failed',
      message: `adding "${entry.name}" makes ${path} too large for a Worker variable (${String(MAX_VAR_BYTES)} bytes). Shorten names or remove projects.`,
    };
  }
  return { kind: 'ready', path, change: upsert.change, text: nextText };
}

/** Finds the folder to make public: the real path, as Claude Code reports it. */
async function projectFolder(flag: string | undefined, io: CommandIo): Promise<string | undefined> {
  if (flag === undefined) return io.cwd;
  try {
    const folder = await realpath(resolve(io.cwd, flag));
    return (await stat(folder)).isDirectory() ? folder : undefined;
  } catch {
    return undefined;
  }
}

/** Replaces the office config, keeping its file mode and following a symlink. */
async function writeOffice(path: string, text: string): Promise<void> {
  const target = await realpath(path);
  const { mode } = await stat(target);
  await writeAtomic(target, text, mode & 0o777);
}

function deployHint(path: string, io: CommandIo): string {
  const base = basename(path);
  const command =
    base === OFFICE_FILE
      ? 'hivefloor deploy'
      : `hivefloor deploy --config ${quoteArg(base, io.windows)}`;
  return dirname(path) === io.cwd ? command : `${command} (from ${dirname(path)})`;
}

function nextStep(office: OfficePlan, entry: PublicEntry, io: CommandIo): string[] {
  if (office.kind !== 'ready') {
    return [
      `No ${OFFICE_FILE} in ${io.cwd}, so the relay rejects "${entry.name}" until you add it there.`,
      `Add this to "publicProjects" in ${OFFICE_FILE}, in your Hivefloor checkout:`,
      `  ${JSON.stringify(entry)}`,
      'Then run hivefloor deploy from that checkout, or run this again with --office-config PATH.',
    ];
  }
  const hint = deployHint(office.path, io);
  return office.change === 'unchanged'
    ? [`If the relay doesn't know "${entry.name}" yet, run: ${hint}`]
    : [`Next: ${hint}. The relay rejects "${entry.name}" until it is deployed.`];
}

/**
 * `hivefloor add-project NAME`: makes a project public in one step. The name goes
 * into the machine config for this folder and into the relay's allowlist in
 * `office.config.json`, which must match exactly (H4). The relay still rejects
 * the name until the new office config is deployed.
 *
 * Idempotent: a second run with the same arguments writes nothing. Everything is
 * validated first, so a failure changes neither file.
 *
 * @param args - Arguments after `add-project`.
 * @param io - Process facilities.
 * @returns 0 on success, 1 when something is invalid or missing, 2 for bad usage,
 * or Wrangler's exit code with `--deploy`.
 */
export async function addProject(args: readonly string[], io: CommandIo): Promise<number> {
  const { values, positionals } = parseArgs({
    args: [...args],
    options,
    strict: true,
    allowPositionals: true,
  });
  const [given, extra] = positionals;
  if (given === undefined || extra !== undefined) {
    io.stderr(USAGE);
    return 2;
  }
  const fail = (message: string): number => {
    io.stderr(`hivefloor: ${message}\n`);
    return 1;
  };

  const name = given.trim();
  const entry: PublicEntry = values.color === undefined ? { name } : { name, color: values.color };
  const { publicProjectProblems } = await import('../edge/validate-config.js');
  const problems = publicProjectProblems(entry);
  if (problems.length > 0) {
    return fail(`"${name}" can't be a public project:\n  ${problems.join('\n  ')}`);
  }

  const files = hivefloorFiles(io.env, io.home, io.windows);
  const raw = await readRawConfig(files);
  if (raw === undefined) return fail(`no ${files.config}. Run hivefloor init first.`);
  if (raw === null) return fail(`${files.config} is not a JSON object. Fix or delete it first.`);

  const folder = await projectFolder(values.path, io);
  if (folder === undefined) return fail(`${String(values.path)} is not a folder.`);

  const office = await planOffice(values['office-config'], entry, io);
  if (office.kind === 'failed') return fail(office.message);
  if (office.kind === 'absent' && values.deploy === true) {
    return fail(
      `--deploy needs ${OFFICE_FILE}, and there is none in ${io.cwd}. Run from your Hivefloor checkout or pass --office-config PATH. Nothing was changed.`,
    );
  }

  const listed: unknown = raw['projects'];
  const machine = upsertMachineProject(Array.isArray(listed) ? listed : [], folder, name, {
    home: io.home,
    windows: io.windows,
  });
  if (machine.change !== 'unchanged') {
    const written = await writeRawConfig(files, { ...raw, projects: machine.projects });
    if (!written.ok) {
      return fail(`the config would be invalid:\n  ${written.problems.join('\n  ')}`);
    }
  }
  const officeChanged = office.kind === 'ready' && office.change !== 'unchanged';
  if (officeChanged) await writeOffice(office.path, office.text);

  const done = [
    ...(machine.change === 'unchanged'
      ? []
      : [`✓ ${folder} is public as "${name}" in ${files.config}`]),
    ...(officeChanged
      ? [`✓ ${office.change === 'added' ? 'Added' : 'Recoloured'} "${name}" (${office.path})`]
      : []),
  ];
  say(
    io,
    ...(done.length > 0 ? done : [`Nothing to change: ${folder} is already public as "${name}".`]),
  );
  if (machine.previousName !== undefined) {
    say(
      io,
      `! "${machine.previousName}" stays in ${OFFICE_FILE}. Remove it there if nothing else uses it.`,
    );
  }
  say(io, "! Anyone viewing the office can see this project's name and its task titles.");
  if (office.kind === 'ready' && values.deploy === true) {
    // The office config sits at the root of the checkout that deploy needs.
    return deploy(['--config', office.path], { ...io, cwd: dirname(office.path) });
  }
  say(io, '', ...nextStep(office, entry, io));
  return 0;
}
