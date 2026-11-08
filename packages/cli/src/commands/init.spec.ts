import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { HOOK_EVENTS, registeredHooks } from '../core/settings.js';
import { testIo } from '../test/io.js';
import { makeDirs } from '../test/sandbox.js';
import { init } from './init.js';

let cleanup: (() => Promise<void>) | undefined;
afterEach(() => cleanup?.());

async function setup() {
  const dirs = await makeDirs();
  cleanup = dirs.cleanup;
  const io = (extra: Partial<Parameters<typeof testIo>[0]> = {}) =>
    testIo({ home: dirs.home, hivefloorHome: dirs.hivefloor, claudeDir: dirs.claude, ...extra });
  const settingsPath = join(dirs.claude, 'settings.json');
  const readJson = async (path: string) =>
    JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  return { dirs, io, settingsPath, readJson };
}

describe('hivefloor init (C1)', () => {
  it('writes the config, a private secret and every hook, then changes nothing the second time', async () => {
    const { dirs, io, settingsPath, readJson } = await setup();
    const first = io();
    expect(await init(['--url', 'https://office.example.com'], first.io)).toBe(0);
    const config = await readJson(join(dirs.hivefloor, 'config.json'));
    expect(config).toEqual({
      $schema: 'https://unpkg.com/hivefloor/machine.schema.json',
      v: 1,
      endpoint: 'https://office.example.com/ingest',
    });
    expect((await readFile(join(dirs.hivefloor, 'secret'), 'utf8')).trim()).toBe(
      'generated-secret-0123456789abcdef',
    );
    if (process.platform !== 'win32')
      expect((await stat(join(dirs.hivefloor, 'secret'))).mode & 0o777).toBe(0o600);
    expect(first.out()).toContain('generated-secret-0123456789abcdef');
    expect(first.out()).toContain('wrangler secret put HIVEFLOOR_SECRET');
    const hooks = registeredHooks(await readJson(settingsPath));
    expect(hooks.map((h) => h.event).sort()).toEqual([...HOOK_EVENTS].sort());
    expect(hooks[0]?.command).toBe(
      '/usr/local/bin/node /usr/local/lib/node_modules/hivefloor/bin.mjs hook',
    );

    const before = await Promise.all(
      [settingsPath, join(dirs.hivefloor, 'config.json'), join(dirs.hivefloor, 'secret')].map((p) =>
        readFile(p, 'utf8'),
      ),
    );
    const second = io();
    expect(await init(['--url', 'https://office.example.com'], second.io)).toBe(0);
    expect(second.out()).toContain('Nothing to change');
    expect(second.out()).not.toContain('generated-secret');
    const after = await Promise.all(
      [settingsPath, join(dirs.hivefloor, 'config.json'), join(dirs.hivefloor, 'secret')].map((p) =>
        readFile(p, 'utf8'),
      ),
    );
    expect(after).toEqual(before);
    expect((await readdir(dirs.claude)).filter((n) => n.includes('backup'))).toEqual([]);
  });

  it('backs up existing settings and keeps every other hook and setting', async () => {
    const { dirs, io, settingsPath, readJson } = await setup();
    await mkdir(dirs.claude, { recursive: true });
    const existing = {
      model: 'opus',
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: './lint.sh' }] }],
      },
    };
    await writeFile(settingsPath, JSON.stringify(existing));
    expect(await init(['--url', 'https://office.example.com'], io().io)).toBe(0);
    const backups = (await readdir(dirs.claude)).filter((n) =>
      n.startsWith('settings.json.hivefloor-backup-'),
    );
    expect(backups).toHaveLength(1);
    expect(await readJson(join(dirs.claude, backups[0] ?? ''))).toEqual(existing);
    const settings = await readJson(settingsPath);
    expect(settings['model']).toBe('opus');
    expect((settings['hooks'] as Record<string, unknown[]>)['PreToolUse']?.[0]).toEqual(
      existing.hooks.PreToolUse[0],
    );
  });

  it('refuses to touch settings that are not JSON', async () => {
    const { dirs, io, settingsPath } = await setup();
    await mkdir(dirs.claude, { recursive: true });
    await writeFile(settingsPath, '{ not json');
    const run = io();
    expect(await init(['--url', 'https://office.example.com'], run.io)).toBe(1);
    expect(run.err()).toContain('not valid JSON');
    expect(await readFile(settingsPath, 'utf8')).toBe('{ not json');
  });

  it('asks interactively for the URL, secret and public project', async () => {
    const { dirs, io, readJson } = await setup();
    const run = io({
      interactive: true,
      answers: ['https://office.example.com', 'pasted-secret-0123456789', 'y', ''],
    });
    expect(await init([], run.io)).toBe(0);
    expect(run.asked).toHaveLength(4);
    expect((await readFile(join(dirs.hivefloor, 'secret'), 'utf8')).trim()).toBe(
      'pasted-secret-0123456789',
    );
    expect((await readJson(join(dirs.hivefloor, 'config.json')))['projects']).toEqual([
      { path: join(dirs.home, 'code', 'ledgerly'), public: true, name: 'ledgerly' },
    ]);
    expect(run.out()).not.toContain('New secret created');
  });

  it('keeps the current URL when the answer is empty and skips questions already answered', async () => {
    const { io } = await setup();
    await init(['--url', 'https://office.example.com', '--public', 'Ledgerly'], io().io);
    const run = io({ interactive: true, answers: [''] });
    expect(await init([], run.io)).toBe(0);
    expect(run.asked).toEqual(['Office URL [https://office.example.com]: ']);
    expect(run.out()).toContain('Nothing to change');
  });

  it('rotates the secret with --rotate and reads one from stdin', async () => {
    const { dirs, io } = await setup();
    await init(
      ['--url', 'https://office.example.com', '--secret-stdin'],
      io({ stdin: 'from-stdin-secret-123456\n' }).io,
    );
    expect((await readFile(join(dirs.hivefloor, 'secret'), 'utf8')).trim()).toBe(
      'from-stdin-secret-123456',
    );
    const rotated = io();
    expect(await init(['--rotate'], rotated.io)).toBe(0);
    expect((await readFile(join(dirs.hivefloor, 'secret'), 'utf8')).trim()).toBe(
      'generated-secret-0123456789abcdef',
    );
    expect(rotated.out()).toContain('New secret created');
  });

  it.each([
    ['no URL', [], {}, 'give the office URL'],
    ['a plain http URL', ['--url', 'http://office.example.com'], {}, 'give the office URL'],
    [
      'a short secret',
      ['--url', 'https://o.example.com', '--secret-stdin'],
      { stdin: 'short' },
      'at least 16',
    ],
    [
      'a short pasted secret',
      ['--url', 'https://o.example.com'],
      { interactive: true, answers: ['tiny'] },
      'at least 16',
    ],
    [
      'an invalid public name',
      ['--url', 'https://o.example.com', '--public', ''],
      {},
      'would be invalid',
    ],
  ])('fails on %s', async (_label, args, extra, message) => {
    const { io } = await setup();
    const run = io(extra);
    expect(await init(args, run.io)).toBe(1);
    expect(run.err()).toContain(message);
  });

  it('rejects a config that is not an object', async () => {
    const { dirs, io } = await setup();
    await mkdir(dirs.hivefloor, { recursive: true });
    await writeFile(join(dirs.hivefloor, 'config.json'), '[]');
    const run = io();
    expect(await init(['--url', 'https://office.example.com'], run.io)).toBe(1);
    expect(run.err()).toContain('not a JSON object');
  });

  it('handles Windows-style paths and an explicit command', async () => {
    const { io, settingsPath, readJson, dirs } = await setup();
    const run = io({
      windows: true,
      cwd: 'C:\\Users\\Ada\\code\\ledgerly',
      script: 'C:\\Users\\Ada\\AppData\\Roaming\\npm\\node_modules\\hivefloor\\bin.mjs',
    });
    expect(
      await init(['--url', 'https://office.example.com', '--public', 'Ledgerly'], run.io),
    ).toBe(0);
    expect((await readJson(join(dirs.hivefloor, 'config.json')))['projects']).toEqual([
      { path: 'C:\\Users\\Ada\\code\\ledgerly', public: true, name: 'Ledgerly' },
    ]);
    expect(registeredHooks(await readJson(settingsPath))[0]?.command).toBe(
      '/usr/local/bin/node C:\\Users\\Ada\\AppData\\Roaming\\npm\\node_modules\\hivefloor\\bin.mjs hook',
    );
    await init(['--command', 'hivefloor hook'], io().io);
    expect(
      registeredHooks(await readJson(settingsPath)).every((h) => h.command === 'hivefloor hook'),
    ).toBe(true);
  });

  it('warns when run through npx', async () => {
    const { io } = await setup();
    const run = io({ script: '/Users/ada/.npm/_npx/1/node_modules/hivefloor/bin.mjs' });
    await init(['--url', 'https://office.example.com'], run.io);
    expect(run.out()).toContain('npm install -g hivefloor');
  });
});
