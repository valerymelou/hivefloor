import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { exampleOfficeConfig } from '@hivefloor/schema/fixtures';
import { commandSandbox } from '../test/setup.js';
import { deploy, findWrangler } from './deploy.js';

let cleanup: (() => Promise<void>) | undefined;
afterEach(() => cleanup?.());

async function checkout(bin: unknown = { wrangler: './bin/wrangler.js' }) {
  const box = await commandSandbox();
  cleanup = box.cleanup;
  const root = join(box.dirs.root, 'hivefloor');
  await mkdir(join(root, 'apps', 'relay'), { recursive: true });
  await mkdir(join(root, 'node_modules', 'wrangler', 'bin'), { recursive: true });
  await writeFile(join(root, 'package.json'), '{"name":"hivefloor-checkout"}');
  await writeFile(
    join(root, 'node_modules', 'wrangler', 'package.json'),
    JSON.stringify({ name: 'wrangler', bin }),
  );
  await writeFile(join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), '');
  await writeFile(join(root, 'apps', 'relay', 'wrangler.jsonc'), '{}');
  await writeFile(join(root, 'office.config.json'), JSON.stringify(exampleOfficeConfig));
  return { box, root };
}

describe('hivefloor deploy (H16)', () => {
  it('validates office.config.json and runs Wrangler with it as OFFICE_CONFIG', async () => {
    const { box, root } = await checkout();
    const run = box.io({ cwd: root });
    expect(await deploy(['--dry-run'], run.io)).toBe(0);
    expect(run.out()).toContain('is valid (3 public projects)');
    expect(run.out()).toContain('wrangler secret put HIVEFLOOR_SECRET');
    const [call] = run.ran;
    expect(call?.file).toBe('/usr/local/bin/node');
    expect(call?.args[0]).toMatch(/node_modules[\\/]wrangler[\\/]bin[\\/]wrangler\.js$/);
    expect(call?.args.slice(1, 4)).toEqual([
      'deploy',
      '--config',
      join(root, 'apps', 'relay', 'wrangler.jsonc'),
    ]);
    const variable = call?.args[5] ?? '';
    expect(call?.args[4]).toBe('--var');
    expect(JSON.parse(variable.slice('OFFICE_CONFIG:'.length))).toMatchObject({
      owner: 'Valery Melou',
      viewerCap: 500,
    });
    expect(call?.args.at(-1)).toBe('--dry-run');
  });

  it('uses node from PATH when running as a compiled binary and passes Wrangler failures through', async () => {
    const { box, root } = await checkout('./bin/wrangler.js');
    const run = box.io({ cwd: root, script: '/$bunfs/root/hivefloor', exitCode: 3 });
    expect(await deploy([], run.io)).toBe(3);
    expect(run.ran[0]?.file).toBe('node');
    expect(run.out()).not.toContain('Deployed');
  });

  it('refuses an invalid, missing or oversized config', async () => {
    const { box, root } = await checkout();
    await writeFile(
      join(root, 'office.config.json'),
      JSON.stringify({ ...exampleOfficeConfig, publicProjects: [{ name: 'A' }, { name: 'a' }] }),
    );
    const invalid = box.io({ cwd: root });
    expect(await deploy([], invalid.io)).toBe(1);
    expect(invalid.err()).toContain('publicProjects.1.name');
    expect(invalid.ran).toEqual([]);
    const missing = box.io({ cwd: root });
    expect(await deploy(['--config', 'nope.json'], missing.io)).toBe(1);
    expect(missing.err()).toContain('office.config.example.json');
    const many = Array.from({ length: 100 }, (_, i) => ({
      name: `Project number ${String(i)} with a long name`.slice(0, 40),
    }));
    await writeFile(
      join(root, 'office.config.json'),
      JSON.stringify({ ...exampleOfficeConfig, publicProjects: many }),
    );
    const big = box.io({ cwd: root });
    expect(await deploy([], big.io)).toBe(1);
    expect(big.err()).toContain('too large');
  });

  it('needs a checkout with Wrangler installed', async () => {
    const box = await commandSandbox();
    cleanup = box.cleanup;
    await writeFile(join(box.dirs.root, 'office.config.json'), JSON.stringify(exampleOfficeConfig));
    const run = box.io({ cwd: box.dirs.root });
    expect(await deploy([], run.io)).toBe(1);
    expect(run.err()).toContain('Hivefloor checkout');
    expect(await findWrangler(box.dirs.root)).toBeUndefined();
  });

  it('ignores a Wrangler package without a bin', async () => {
    const { root } = await checkout({ other: './x.js' });
    expect(await findWrangler(root)).toBeUndefined();
  });
});
