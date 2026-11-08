import { afterEach, describe, expect, it } from 'vitest';
import { payloads, SECRET } from './test/payloads.js';
import { fakeRelay, makeHome } from './test/sandbox.js';
import { signBody } from './core/sign.js';
import { main, VERSION, type MainIo } from './main.js';

let cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.map((c) => c()));
  cleanups = [];
});

function io(home: string, stdin = '', extra: Partial<MainIo> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const sent: string[] = [];
  const value: MainIo = {
    env: { HIVEFLOOR_HOME: home },
    home: '/Users/ada',
    windows: false,
    now: () => 1794096003_000,
    readStdin: () => Promise.resolve(stdin),
    stdout: (t) => out.push(t),
    stderr: (t) => err.push(t),
    launchSender: (b) => sent.push(b),
    fetch,
    ...extra,
  };
  return { value, out, err, sent };
}

describe('main', () => {
  it('prints the version and help', async () => {
    const version = io('/nowhere');
    expect(await main(['--version'], version.value)).toBe(0);
    expect(version.out).toEqual([`${VERSION}\n`]);
    const help = io('/nowhere');
    expect(await main([], help.value)).toBe(0);
    expect(help.out.join('')).toContain('hivefloor hook');
  });

  it('rejects unknown commands on stderr', async () => {
    const run = io('/nowhere');
    expect(await main(['launch'], run.value)).toBe(1);
    expect(run.out).toEqual([]);
    expect(run.err.join('')).toContain('unknown command "launch"');
  });

  it('runs the hook silently and always exits 0', async () => {
    const home = await makeHome({ v: 1, endpoint: 'https://office.example.com/ingest' });
    cleanups.push(home.cleanup);
    const run = io(home.files.dir, JSON.stringify(payloads.sessionStart()));
    expect(await main(['hook'], run.value)).toBe(0);
    expect(run.out).toEqual([]);
    expect(run.sent).toHaveLength(1);
    const broken = io(home.files.dir, '', { readStdin: () => Promise.reject(new Error('boom')) });
    expect(await main(['hook'], broken.value)).toBe(0);
    expect(broken.out).toEqual([]);
  });

  it('sends a signed event with __send', async () => {
    const relay = await fakeRelay();
    cleanups.push(relay.close);
    const home = await makeHome({ v: 1, endpoint: relay.url });
    cleanups.push(home.cleanup);
    const run = io(home.files.dir, '', {
      env: { HIVEFLOOR_HOME: home.files.dir, HIVEFLOOR_DEBUG: '1' },
    });
    expect(await main(['__send', '{"v":1}'], run.value)).toBe(0);
    expect(relay.received[0]?.headers['x-office-signature']).toBe(
      signBody(SECRET, 1794096003, '{"v":1}'),
    );
    expect(run.out).toEqual([]);
  });

  it('stays silent when __send has nothing to send or fails', async () => {
    const run = io('/nowhere');
    expect(await main(['__send'], run.value)).toBe(0);
    const home = await makeHome({ v: 1, endpoint: 'https://office.example.com/ingest' });
    cleanups.push(home.cleanup);
    const failing = io(home.files.dir, '', {
      fetch: () => {
        throw new Error('sync failure');
      },
    });
    expect(await main(['__send', '{}'], failing.value)).toBe(0);
  });
});
