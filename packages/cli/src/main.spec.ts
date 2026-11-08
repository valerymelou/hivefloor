import { afterEach, describe, expect, it } from 'vitest';
import { signBody } from './core/sign.js';
import { main, VERSION } from './main.js';
import { payloads, SECRET } from './test/payloads.js';
import { fakeRelay } from './test/sandbox.js';
import { commandSandbox } from './test/setup.js';

let cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.map((c) => c()));
  cleanups = [];
});

async function box() {
  const sandbox = await commandSandbox();
  cleanups.push(sandbox.cleanup);
  return sandbox;
}

describe('main', () => {
  it('prints the version and help', async () => {
    const b = await box();
    const version = b.io();
    expect(await main(['--version'], version.io)).toBe(0);
    expect(version.out()).toBe(`${VERSION}\n`);
    for (const args of [[], ['help'], ['-h']]) {
      const help = b.io();
      expect(await main(args, help.io)).toBe(0);
      expect(help.out()).toContain('hivefloor init');
    }
  });

  it('rejects unknown commands and flags on stderr with exit code 2', async () => {
    const b = await box();
    const unknown = b.io();
    expect(await main(['launch'], unknown.io)).toBe(2);
    expect(unknown.out()).toBe('');
    expect(unknown.err()).toContain('unknown command "launch"');
    const badFlag = b.io();
    expect(await main(['pause', '--forever'], badFlag.io)).toBe(2);
    expect(badFlag.err()).toContain('hivefloor pause:');
  });

  it.each(['init', 'doctor', 'preview', 'pause', 'resume', 'uninstall', 'deploy'])(
    'dispatches %s',
    async (command) => {
      const b = await box();
      const run = b.io({ cwd: b.dirs.root });
      const code = await main([command], run.io);
      expect([0, 1]).toContain(code);
      expect(run.out() + run.err()).not.toBe('');
    },
  );

  it('runs the hook silently and always exits 0', async () => {
    const b = await box();
    await b.seed({ v: 1, endpoint: 'https://office.example.com/ingest' });
    const run = b.io({ stdin: JSON.stringify(payloads.sessionStart()) });
    expect(await main(['hook'], run.io)).toBe(0);
    expect(run.out()).toBe('');
    expect(run.sent).toHaveLength(1);
    const broken = b.io();
    const io = { ...broken.io, readStdin: () => Promise.reject(new Error('boom')) };
    expect(await main(['hook'], io)).toBe(0);
    expect(broken.out()).toBe('');
  });

  it('sends a signed event with __send, and stays silent on failure', async () => {
    const relay = await fakeRelay();
    cleanups.push(relay.close);
    const b = await box();
    await b.seed({ v: 1, endpoint: relay.url });
    const run = b.io({ fetch });
    const io = { ...run.io, env: { ...run.io.env, HIVEFLOOR_DEBUG: '1' } };
    expect(await main(['__send', '{"v":1}'], io)).toBe(0);
    expect(relay.received[0]?.headers['x-office-signature']).toBe(
      signBody(SECRET, 1794096004, '{"v":1}'),
    );
    expect(run.out()).toBe('');
    expect(await main(['__send'], b.io().io)).toBe(0);
    const throwing = b.io({
      fetch: () => {
        throw new Error('sync failure');
      },
    });
    expect(await main(['__send', '{}'], throwing.io)).toBe(0);
  });
});
