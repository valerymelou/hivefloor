import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
    expect(run.out()).toContain('no secret was set');
    expect(run.ran).toHaveLength(1);
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

  it('offers to create a secret and sets it on the relay through stdin, once', async () => {
    const { box, root } = await checkout();
    const first = box.io({ cwd: root, interactive: true, answers: [''] });
    expect(await deploy([], first.io)).toBe(0);
    expect(first.asked[0]).toContain('replaces any secret');
    const put = first.ran[1];
    expect(put?.args.slice(1, 4)).toEqual(['secret', 'put', 'HIVEFLOOR_SECRET']);
    const saved = (await readFile(box.paths.secret, 'utf8')).trim();
    expect(saved.length).toBeGreaterThanOrEqual(16);
    expect(put?.input).toBe(saved);
    expect(put?.args.join(' ')).not.toContain(saved);
    expect(first.out()).not.toContain(saved);
    expect(first.out()).toContain('hivefloor init --url');

    const second = box.io({ cwd: root, interactive: true });
    expect(await deploy([], second.io)).toBe(0);
    expect(second.ran).toHaveLength(1);
    expect(second.asked).toEqual([]);
    expect(second.out()).toContain('hivefloor init --url');
  });

  it('leaves the relay alone when you say no, and when nobody can answer', async () => {
    const { box, root } = await checkout();
    const declined = box.io({ cwd: root, interactive: true, answers: ['n'] });
    expect(await deploy([], declined.io)).toBe(0);
    expect(declined.ran).toHaveLength(1);
    expect(declined.out()).toContain('--push-secret');
    const unattended = box.io({ cwd: root, interactive: false });
    expect(await deploy([], unattended.io)).toBe(0);
    expect(unattended.ran).toHaveLength(1);
    expect(unattended.asked).toEqual([]);
  });

  it('sets a secret with --push-secret, without asking', async () => {
    const { box, root } = await checkout();
    const created = box.io({ cwd: root, interactive: false });
    expect(await deploy(['--push-secret'], created.io)).toBe(0);
    const saved = (await readFile(box.paths.secret, 'utf8')).trim();
    expect(created.ran[1]?.input).toBe(saved);
    const again = box.io({ cwd: root, interactive: false });
    expect(await deploy(['--push-secret'], again.io)).toBe(0);
    expect(again.ran[1]?.input).toBe(saved);
  });

  it('says how to recover when setting the secret fails', async () => {
    const { box, root } = await checkout();
    let calls = 0;
    const run = box.io({ cwd: root, interactive: false });
    const io = {
      ...run.io,
      runProcess: () => Promise.resolve(++calls === 1 ? 0 : 7),
    };
    expect(await deploy(['--push-secret'], io)).toBe(7);
    expect(run.err()).toContain('--push-secret');
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

  it('finds the Wrangler pnpm installs for the relay', async () => {
    const box = await commandSandbox();
    cleanup = box.cleanup;
    const root = join(box.dirs.root, 'hivefloor');
    const wrangler = join(root, 'apps', 'relay', 'node_modules', 'wrangler');
    await mkdir(join(wrangler, 'bin'), { recursive: true });
    await writeFile(join(root, 'package.json'), '{}');
    await writeFile(join(root, 'apps', 'relay', 'package.json'), '{}');
    await writeFile(
      join(wrangler, 'package.json'),
      JSON.stringify({ name: 'wrangler', bin: { wrangler: './bin/wrangler.js' } }),
    );
    await writeFile(join(wrangler, 'bin', 'wrangler.js'), '');
    expect(await findWrangler(root)).toMatch(/apps[\\/]relay[\\/]node_modules[\\/]wrangler/);
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
