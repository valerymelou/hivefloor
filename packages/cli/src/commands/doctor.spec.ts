import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { signBody } from '../core/sign.js';
import { SECRET } from '../test/payloads.js';
import { fakeOffice } from '../test/sandbox.js';
import { commandSandbox } from '../test/setup.js';
import { doctor } from './doctor.js';
import { init } from './init.js';

let cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.map((c) => c()));
  cleanups = [];
});

// The test clock (see test/io.ts) starts here, so the relay's Date header matches it.
const TEST_NOW = 1794096003_000;

async function setup(office: unknown, options: Parameters<typeof fakeOffice>[1] = {}) {
  const relay = await fakeOffice(office, { date: new Date(TEST_NOW).toUTCString(), ...options });
  const box = await commandSandbox();
  cleanups.push(relay.close, box.cleanup);
  await init(['--url', relay.url, '--public', 'Ledgerly'], box.io({ stdin: '' }).io);
  return { relay, box };
}

describe('hivefloor doctor (C10)', () => {
  it('passes every check and sends a signed dry-run event', async () => {
    const { relay, box } = await setup({
      publicProjects: [{ name: 'Ledgerly' }],
      agentTypes: ['Helper'],
    });
    const run = box.io({ fetch, cwd: join(box.dirs.home, 'code', 'ledgerly') });
    expect(await doctor([], run.io)).toBe(0);
    expect(run.out()).not.toContain('✗');
    expect(run.out()).not.toContain('!');
    expect(run.out()).toContain('✓ Clock');
    expect(run.out()).toContain('✓ Claude Code hooks');
    expect(run.out()).toContain('✓ Signed test event');
    expect(run.out()).toContain('exactly this leaves your machine');
    expect(run.out()).toContain('"project":"Ledgerly"');
    const ingest = relay.received.find((r) => r.path === '/ingest');
    expect(ingest?.headers['x-office-dry-run']).toBe('1');
    const secret = 'generated-secret-0123456789abcdef';
    expect(ingest?.headers['x-office-signature']).toBe(
      signBody(secret, Number(ingest?.headers['x-office-timestamp']), ingest?.body ?? ''),
    );
  });

  it('flags unknown projects (H4), clock skew (H8) and a rejected event', async () => {
    const old = new Date(TEST_NOW - 120_000).toUTCString();
    const { box } = await setup(
      { publicProjects: [], agentTypes: [] },
      { ingestStatus: 400, date: old },
    );
    const run = box.io({ fetch });
    expect(await doctor([], run.io)).toBe(1);
    expect(run.out()).toContain('✗ Public projects: Not in the relay');
    expect(run.out()).toMatch(/! Clock: Your clock is \d+ s ahead/);
    expect(run.out()).toContain('✗ Signed test event');
  });

  it('reports a relay that is down or answers an error', async () => {
    const { box } = await setup({}, { configStatus: 500 });
    const run = box.io({ fetch });
    expect(await doctor([], run.io)).toBe(1);
    expect(run.out()).toContain('answered 500');
    const offline = box.io();
    expect(await doctor([], offline.io)).toBe(1);
    expect(offline.out()).toContain('Could not reach');
  });

  it('reports a missing or invalid setup without crashing', async () => {
    const box = await commandSandbox();
    cleanups.push(box.cleanup);
    const empty = box.io();
    expect(await doctor([], empty.io)).toBe(1);
    expect(empty.out()).toContain('✗ Config: No config');
    expect(empty.out()).toContain('✗ Secret');
    expect(empty.out()).toContain('✗ Claude Code hooks: Not registered');
    await box.seed({ v: 1, endpoint: 'nope' }, null);
    await mkdir(box.dirs.claude, { recursive: true });
    await writeFile(box.paths.settings, '{');
    const invalid = box.io();
    expect(await doctor([], invalid.io)).toBe(1);
    expect(invalid.out()).toContain('is invalid');
    expect(invalid.out()).toContain("can't be read");
  });

  it.skipIf(process.platform === 'win32')(
    'warns about a readable secret and a paused config',
    async () => {
      const box = await commandSandbox();
      cleanups.push(box.cleanup);
      await box.seed({ v: 1, endpoint: 'https://office.example.com/ingest', paused: true }, SECRET);
      await chmod(box.paths.secret, 0o644);
      const run = box.io();
      await doctor([], run.io);
      expect(run.out()).toContain('! Sending: Paused');
      expect(run.out()).toContain('readable by other users');
    },
  );
});
