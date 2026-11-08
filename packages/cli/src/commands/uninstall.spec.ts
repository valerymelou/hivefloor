import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { commandSandbox } from '../test/setup.js';
import { init } from './init.js';
import { uninstall } from './uninstall.js';

let cleanup: (() => Promise<void>) | undefined;
afterEach(() => cleanup?.());

describe('hivefloor uninstall (C13)', () => {
  it('removes only its hooks and keeps the config unless --purge', async () => {
    const box = await commandSandbox();
    cleanup = box.cleanup;
    await mkdir(box.dirs.claude, { recursive: true });
    const mine = {
      model: 'opus',
      hooks: { Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }] },
    };
    await writeFile(box.paths.settings, JSON.stringify(mine));
    await init(['--url', 'https://office.example.com'], box.io().io);

    const run = box.io();
    expect(await uninstall([], run.io)).toBe(0);
    expect(run.out()).toContain('Removed the Hivefloor hook from 9 events');
    expect(await box.readJson(box.paths.settings)).toEqual(mine);
    expect(existsSync(box.paths.config)).toBe(true);
    expect((await readdir(box.dirs.claude)).filter((n) => n.includes('backup'))).toHaveLength(2);

    const again = box.io();
    expect(await uninstall(['--purge'], again.io)).toBe(0);
    expect(again.out()).toContain('No Hivefloor hooks');
    expect(existsSync(box.dirs.hivefloor)).toBe(false);
  });

  it('works without a settings file and refuses an invalid one', async () => {
    const box = await commandSandbox();
    cleanup = box.cleanup;
    expect(await uninstall([], box.io().io)).toBe(0);
    await mkdir(box.dirs.claude, { recursive: true });
    await writeFile(box.paths.settings, '[1]');
    const run = box.io();
    expect(await uninstall([], run.io)).toBe(1);
    expect(run.err()).toContain('not a JSON object');
  });
});
