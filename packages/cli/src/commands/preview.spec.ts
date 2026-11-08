import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { payloads, PRIVATE_STRINGS } from '../test/payloads.js';
import { commandSandbox } from '../test/setup.js';
import { preview } from './preview.js';

let cleanup: (() => Promise<void>) | undefined;
afterEach(() => cleanup?.());

async function setup(config: Record<string, unknown> = {}) {
  const box = await commandSandbox();
  cleanup = box.cleanup;
  await box.seed({
    v: 1,
    endpoint: 'https://office.example.com/ingest',
    projects: [{ path: join(box.dirs.home, 'code', 'ledgerly'), public: true, name: 'Ledgerly' }],
    ...config,
  });
  return box;
}

describe('hivefloor preview (C11)', () => {
  it('prints the sanitized event without sending or saving anything', async () => {
    const box = await setup();
    const payload = {
      ...payloads.sessionStart(),
      cwd: join(box.dirs.home, 'code', 'ledgerly', 'src'),
    };
    const run = box.io({ stdin: JSON.stringify(payload) });
    expect(await preview([], run.io)).toBe(0);
    expect(run.out()).toContain('This would leave your machine:');
    expect(run.out()).toContain('"project": "Ledgerly"');
    expect(run.out()).toContain('"goal": "Building the paywall screen"');
    for (const secret of PRIVATE_STRINGS) expect(run.out()).not.toContain(secret);
    expect(run.sent).toEqual([]);
  });

  it('says when nothing would be sent, and when paused', async () => {
    const box = await setup({ paused: true });
    const nothing = box.io({
      stdin: JSON.stringify({ hook_event_name: 'Notification', session_id: 'x' }),
    });
    expect(await preview([], nothing.io)).toBe(0);
    expect(nothing.out()).toContain('Nothing would be sent for Notification');
    const paused = box.io({ stdin: JSON.stringify(payloads.stop()) });
    await preview([], paused.io);
    expect(paused.out()).toContain('Sending is paused');
  });

  it('warns when the relay did not know the project at the last doctor (H4)', async () => {
    const box = await setup();
    await mkdir(join(box.dirs.hivefloor, 'state'), { recursive: true });
    await writeFile(
      join(box.dirs.hivefloor, 'state', 'office.cache.json'),
      JSON.stringify({ publicProjects: [{ name: 'Other' }] }),
    );
    const payload = { ...payloads.stop(), cwd: join(box.dirs.home, 'code', 'ledgerly') };
    const run = box.io({ stdin: JSON.stringify(payload) });
    await preview([], run.io);
    expect(run.out()).toContain('did not know "Ledgerly"');
  });

  it('matches Windows-style paths case-insensitively', async () => {
    const box = await setup({
      projects: [{ path: 'C:\\Users\\Ada\\Code\\Ledgerly', public: true, name: 'Ledgerly' }],
    });
    const run = box.io({
      windows: true,
      stdin: JSON.stringify({ ...payloads.stop(), cwd: 'c:\\users\\ada\\code\\ledgerly\\apps' }),
    });
    await preview([], run.io);
    expect(run.out()).toContain('"project": "Ledgerly"');
  });

  it('fails without a config or a payload', async () => {
    const box = await commandSandbox();
    cleanup = box.cleanup;
    expect(await preview([], box.io().io)).toBe(1);
    await box.seed({ v: 1, endpoint: 'https://office.example.com/ingest' });
    const run = box.io({ stdin: 'nope' });
    expect(await preview([], run.io)).toBe(1);
    expect(run.err()).toContain('pipe one hook payload');
  });
});
