import { chmod, mkdir, open, readFile, realpath, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { exampleOfficeConfig } from '@hivefloor/schema/fixtures';
import { afterEach, describe, expect, it } from 'vitest';
import { commandSandbox } from '../test/setup.js';
import { main } from '../main.js';
import { addProject } from './add-project.js';

const ENDPOINT = 'https://office.example.com/ingest';
const WARNING = "Anyone viewing the office can see this project's name and its task titles.";

// Windows has no file modes, and creating symlinks there needs extra rights.
const POSIX_ONLY = process.platform === 'win32';

let cleanup: (() => Promise<void>) | undefined;
afterEach(() => cleanup?.());

/** Seeds a machine config, or none at all with `null`. */
async function setup(machine: unknown = { v: 1, endpoint: ENDPOINT }) {
  const box = await commandSandbox();
  cleanup = box.cleanup;
  const cwd = join(box.dirs.home, 'code', 'ledgerly');
  if (machine !== null) await box.seed(machine);
  const officePath = join(cwd, 'office.config.json');
  const writeOffice = (config: unknown = exampleOfficeConfig, path = officePath) =>
    writeFile(path, typeof config === 'string' ? config : JSON.stringify(config));
  const projects = async () => (await box.readJson(box.paths.config))['projects'];
  const publicNames = async (path = officePath) =>
    ((await box.readJson(path))['publicProjects'] as { name: string }[]).map((p) => p.name);
  return { box, cwd, officePath, writeOffice, projects, publicNames };
}

/** A file's text and modification time, read through one handle. */
async function snapshot(path: string) {
  const handle = await open(path);
  try {
    const { mtimeMs } = await handle.stat();
    return { text: await handle.readFile('utf8'), mtimeMs };
  } finally {
    await handle.close();
  }
}

/** A folder that `deploy` accepts: package.json, Wrangler and its config. */
async function checkout(root: string) {
  await mkdir(join(root, 'apps', 'relay'), { recursive: true });
  await mkdir(join(root, 'node_modules', 'wrangler', 'bin'), { recursive: true });
  await writeFile(join(root, 'package.json'), '{}');
  await writeFile(
    join(root, 'node_modules', 'wrangler', 'package.json'),
    '{"name":"wrangler","bin":"./bin/wrangler.js"}',
  );
  await writeFile(join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), '');
  await writeFile(join(root, 'apps', 'relay', 'wrangler.jsonc'), '{}');
  await writeFile(join(root, 'office.config.json'), JSON.stringify(exampleOfficeConfig));
  return join(root, 'office.config.json');
}

describe('hivefloor add-project', () => {
  it('makes the current folder public in both files and says to deploy', async () => {
    const { box, cwd, officePath, writeOffice, projects } = await setup();
    await writeOffice();
    const run = box.io();
    expect(await addProject(['  Paywall ', '--color', '#123456'], run.io)).toBe(0);
    expect(await projects()).toEqual([{ path: cwd, public: true, name: 'Paywall' }]);
    const office = await box.readJson(officePath);
    expect((office['publicProjects'] as unknown[]).at(-1)).toEqual({
      name: 'Paywall',
      color: '#123456',
    });
    expect(office['owner']).toBe(exampleOfficeConfig.owner);
    expect(run.out()).toContain(WARNING);
    expect(run.out()).toContain('Next: hivefloor deploy.');
    expect(run.ran).toEqual([]);
  });

  it('changes nothing on a second run', async () => {
    const { box, officePath, writeOffice } = await setup();
    await writeOffice();
    const args = ['Paywall', '--color', '#123456'];
    expect(await addProject(args, box.io().io)).toBe(0);
    const before = [await snapshot(box.paths.config), await snapshot(officePath)];
    const again = box.io();
    expect(await addProject(args, again.io)).toBe(0);
    expect(again.out()).toContain('Nothing to change');
    expect(again.out()).toContain(WARNING);
    expect(again.out()).toContain('If the relay doesn');
    expect([await snapshot(box.paths.config), await snapshot(officePath)]).toEqual(before);
  });

  it('writes only publicProjects into the office config, not the defaults', async () => {
    const minimal = { v: 1, owner: 'Ada', timezone: 'UTC' };
    const { box, officePath, writeOffice } = await setup();
    await writeOffice(minimal);
    expect(await addProject(['Paywall'], box.io().io)).toBe(0);
    expect(await box.readJson(officePath)).toEqual({
      ...minimal,
      publicProjects: [{ name: 'Paywall' }],
    });
  });

  it('updates an existing entry in place and points out the old name', async () => {
    const other = { path: '/code/other', public: false };
    const { box, writeOffice, projects } = await setup({
      v: 1,
      endpoint: ENDPOINT,
      paused: true,
      projects: [{ path: '~/code/ledgerly', public: true, name: 'Ledgerly' }, other],
    });
    await writeOffice();
    const run = box.io();
    expect(await addProject(['Paywall'], run.io)).toBe(0);
    expect(await projects()).toEqual([
      { path: '~/code/ledgerly', public: true, name: 'Paywall' },
      other,
    ]);
    expect((await box.readJson(box.paths.config))['paused']).toBe(true);
    expect(run.out()).toContain('"Ledgerly" stays in office.config.json');
  });

  it('recolours an existing office entry and leaves the name alone', async () => {
    const { box, writeOffice, officePath, projects } = await setup();
    await writeOffice();
    const run = box.io();
    expect(await addProject(['Ledgerly', '--color', '#000000'], run.io)).toBe(0);
    expect(run.out()).toContain('Recoloured "Ledgerly"');
    const listed = (await box.readJson(officePath))['publicProjects'] as Record<string, unknown>[];
    expect(listed.find((p) => p['name'] === 'Ledgerly')).toEqual({
      name: 'Ledgerly',
      color: '#000000',
      group: 'mobile',
    });
    expect(listed).toHaveLength(3);
    expect(await projects()).toHaveLength(1);
  });

  it.skipIf(POSIX_ONLY)(
    'uses --path, resolved from the current folder to its real path',
    async () => {
      const { box, projects } = await setup();
      const real = join(box.dirs.home, 'code', 'real');
      const link = join(box.dirs.home, 'code', 'link');
      await mkdir(real);
      await symlink(real, link);
      expect(await addProject(['Paywall', '--path', '../link'], box.io().io)).toBe(0);
      expect(await projects()).toEqual([
        { path: await realpath(real), public: true, name: 'Paywall' },
      ]);
    },
  );

  it('refuses a --path that is not a folder', async () => {
    const { box, cwd, projects } = await setup();
    await writeFile(join(cwd, 'file'), '');
    for (const path of ['file', 'missing']) {
      const run = box.io();
      expect(await addProject(['Paywall', '--path', path], run.io)).toBe(1);
      expect(run.err()).toContain(`${path} is not a folder`);
    }
    expect(await projects()).toBeUndefined();
  });

  it('finds the office config through --office-config and says where to deploy from', async () => {
    const { box, publicNames } = await setup();
    const other = join(box.dirs.root, 'checkout');
    await mkdir(other);
    const path = join(other, 'staging.json');
    await writeFile(path, JSON.stringify(exampleOfficeConfig));
    const run = box.io();
    expect(await addProject(['Paywall', '--office-config', path], run.io)).toBe(0);
    expect(await publicNames(path)).toContain('Paywall');
    expect(run.out()).toContain(`Next: hivefloor deploy --config staging.json (from ${other})`);
  });

  it.skipIf(POSIX_ONLY)('keeps the office config mode and writes through a symlink', async () => {
    const { box, cwd, officePath, writeOffice, publicNames } = await setup();
    await writeOffice();
    await chmod(officePath, 0o644);
    const link = join(cwd, 'linked.json');
    await symlink(officePath, link);
    expect(await addProject(['Paywall', '--office-config', link], box.io().io)).toBe(0);
    expect(await publicNames()).toContain('Paywall');
    expect((await stat(officePath)).mode & 0o777).toBe(0o644);
  });

  it('says exactly what to add when it finds no office config', async () => {
    const { box, cwd, projects } = await setup();
    const run = box.io();
    expect(await addProject(['Paywall', '--color', '#123456'], run.io)).toBe(0);
    expect(await projects()).toEqual([{ path: cwd, public: true, name: 'Paywall' }]);
    expect(run.out()).toContain(`No office.config.json in ${cwd}`);
    expect(run.out()).toContain('"publicProjects"');
    expect(run.out()).toContain('{"name":"Paywall","color":"#123456"}');
    expect(run.out()).toContain('hivefloor deploy');
    expect(run.out()).toContain(WARNING);

    const again = box.io();
    expect(await addProject(['Paywall', '--color', '#123456'], again.io)).toBe(0);
    expect(again.out()).toContain('Nothing to change');
    expect(again.out()).toContain('{"name":"Paywall","color":"#123456"}');
  });

  it('with --deploy, deploys from the folder of the office config', async () => {
    const { box, projects } = await setup();
    const root = join(box.dirs.root, 'checkout');
    const officePath = await checkout(root);
    const run = box.io();
    expect(await addProject(['Paywall', '--office-config', officePath, '--deploy'], run.io)).toBe(
      0,
    );
    expect(await projects()).toHaveLength(1);
    expect(run.out()).not.toContain('Next:');
    expect(run.out().indexOf(WARNING)).toBeLessThan(run.out().indexOf('is valid'));
    const args = run.ran[0]?.args ?? [];
    expect(args.slice(1, 4)).toEqual([
      'deploy',
      '--config',
      join(root, 'apps/relay/wrangler.jsonc'),
    ]);
    expect(args[5]).toContain('"name":"Paywall"');
  });

  it('with --deploy, deploys even when the files are already right and passes on failures', async () => {
    const { box } = await setup();
    const officePath = await checkout(join(box.dirs.root, 'checkout'));
    const args = ['Ledgerly', '--office-config', officePath, '--deploy'];
    expect(await addProject(args, box.io().io)).toBe(0);
    const again = box.io({ exitCode: 3 });
    expect(await addProject(args, again.io)).toBe(3);
    expect(again.ran).toHaveLength(1);
  });

  it('refuses --deploy without an office config, before writing anything', async () => {
    const { box, projects } = await setup();
    const run = box.io();
    expect(await addProject(['Paywall', '--deploy'], run.io)).toBe(1);
    expect(run.err()).toContain('--deploy needs office.config.json');
    expect(await projects()).toBeUndefined();
    expect(run.ran).toEqual([]);
  });

  it('refuses a bad name or colour, wherever the office config is', async () => {
    const { box, projects } = await setup();
    for (const [args, problem] of [
      [['   '], 'name'],
      [['x'.repeat(41)], 'name'],
      [['Private'], 'reserved room id'],
      [['Paywall', '--color', 'red'], 'color: Expected a #rrggbb colour'],
    ] as const) {
      const run = box.io();
      expect(await addProject(args, run.io)).toBe(1);
      expect(run.err()).toContain(problem);
    }
    expect(await projects()).toBeUndefined();
  });

  it('refuses a machine config that is not JSON and leaves it alone', async () => {
    const { box } = await setup('not json');
    const run = box.io();
    expect(await addProject(['Paywall'], run.io)).toBe(1);
    expect(run.err()).toContain('is not a JSON object');
    expect(await readFile(box.paths.config, 'utf8')).toBe('not json');
  });

  it('needs init first', async () => {
    const { box } = await setup(null);
    const run = box.io();
    expect(await addProject(['Paywall'], run.io)).toBe(1);
    expect(run.err()).toContain('Run hivefloor init first');
  });

  it('leaves the office config alone when the machine config would be invalid', async () => {
    const { box, officePath, writeOffice, publicNames } = await setup({ v: 1 });
    await writeOffice();
    const run = box.io();
    expect(await addProject(['Paywall'], run.io)).toBe(1);
    expect(run.err()).toContain('endpoint');
    expect(await publicNames(officePath)).not.toContain('Paywall');
  });

  it.each([
    ['not JSON', 'not json', '(file): not valid JSON'],
    ['invalid', { v: 2 }, 'is invalid'],
  ])('refuses an office config that is %s and writes nothing', async (_, office, message) => {
    const { box, writeOffice, projects } = await setup();
    await writeOffice(office);
    const run = box.io();
    expect(await addProject(['Paywall'], run.io)).toBe(1);
    expect(run.err()).toContain(message);
    expect(await projects()).toBeUndefined();
  });

  it('refuses a missing --office-config', async () => {
    const { box, projects } = await setup();
    const run = box.io();
    expect(await addProject(['Paywall', '--office-config', 'nope.json'], run.io)).toBe(1);
    expect(run.err()).toContain('Check the path given to --office-config');
    expect(await projects()).toBeUndefined();
  });

  it('refuses a name that differs only by case and names the existing spelling', async () => {
    const { box, writeOffice, projects } = await setup();
    await writeOffice();
    const run = box.io();
    expect(await addProject(['ledgerly'], run.io)).toBe(1);
    expect(run.err()).toContain('already lists "Ledgerly"');
    expect(await projects()).toBeUndefined();
  });

  it('refuses a name with the same room id as another project', async () => {
    const { box, writeOffice, projects } = await setup();
    await writeOffice();
    const run = box.io();
    expect(await addProject(['Ndop-UI'], run.io)).toBe(1);
    expect(run.err()).toContain('has the same room id');
    expect(await projects()).toBeUndefined();
  });

  it('refuses to make the office config too large to deploy', async () => {
    const { box, writeOffice, projects, publicNames } = await setup();
    const publicProjects = Array.from({ length: 99 }, (_, i) => ({
      name: `${'x'.repeat(30)}${String(i)}`,
      color: '#123456',
    }));
    await writeOffice({ ...exampleOfficeConfig, publicProjects });
    const run = box.io();
    expect(await addProject(['Paywall'], run.io)).toBe(1);
    expect(run.err()).toContain('too large');
    expect(await publicNames()).not.toContain('Paywall');
    expect(await projects()).toBeUndefined();
  });

  it('reports bad usage with exit code 2', async () => {
    const { box } = await setup();
    for (const args of [
      ['add-project'],
      ['add-project', 'A', 'B'],
      ['add-project', 'A', '--nope'],
    ]) {
      const run = box.io();
      expect(await main(args, run.io)).toBe(2);
      expect(run.err()).toMatch(/add-project/i);
    }
  });
});
