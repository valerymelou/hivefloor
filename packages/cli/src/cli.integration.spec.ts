import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { signBody } from './core/sign.js';
import { payloads, PRIVATE_STRINGS, SECRET } from './test/payloads.js';
import { fakeRelay, makeHome } from './test/sandbox.js';

// Runs the built bundle (`nx test cli` builds it first), as Claude Code would.
const BIN = fileURLToPath(new URL('../../../dist/packages/cli/bin.mjs', import.meta.url));
let cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.map((c) => c()));
  cleanups = [];
});

function hook(home: string, input: string) {
  return spawnSync(process.execPath, [BIN, 'hook'], {
    input,
    env: { ...process.env, HIVEFLOOR_HOME: home, HOME: '/Users/ada', USERPROFILE: '/Users/ada' },
    encoding: 'utf8',
    timeout: 10_000,
  });
}

async function waitFor(check: () => boolean, ms = 5000): Promise<void> {
  const until = Date.now() + ms;
  while (!check() && Date.now() < until) await new Promise((r) => setTimeout(r, 25));
}

describe.skipIf(!existsSync(BIN))('hivefloor hook (built bundle)', () => {
  it('posts a signed, sanitized event from a detached sender, printing nothing', async () => {
    const relay = await fakeRelay();
    cleanups.push(relay.close);
    const home = await makeHome({
      v: 1,
      endpoint: relay.url,
      projects: [{ path: '~/code/ledgerly', public: true, name: 'Ledgerly' }],
    });
    cleanups.push(home.cleanup);
    const result = hook(home.files.dir, JSON.stringify(payloads.sessionStart()));
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    await waitFor(() => relay.received.length > 0);
    const [request] = relay.received;
    const event = JSON.parse(request?.body ?? '{}') as Record<string, unknown>;
    expect(event).toMatchObject({ v: 1, kind: 'start', role: 'claude', project: 'Ledgerly' });
    const timestamp = Number(request?.headers['x-office-timestamp']);
    expect(request?.headers['x-office-signature']).toBe(
      signBody(SECRET, timestamp, request?.body ?? ''),
    );
    for (const secret of PRIVATE_STRINGS) expect(request?.body).not.toContain(secret);
  });

  it.each([
    ['malformed input', 'not json {{{'],
    ['empty input', ''],
    ['a huge input', 'x'.repeat(9 * 1024 * 1024)],
  ])('exits 0 with no output on %s', async (_label, input) => {
    const home = await makeHome({ v: 1, endpoint: 'https://office.example.com/ingest' });
    cleanups.push(home.cleanup);
    const result = hook(home.files.dir, input);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('exits 0 with no output when the endpoint is dead or the config is broken', async () => {
    const dead = await makeHome({ v: 1, endpoint: 'http://127.0.0.1:9/ingest' });
    cleanups.push(dead.cleanup);
    expect(hook(dead.files.dir, JSON.stringify(payloads.bash('ls'))).stdout).toBe('');
    const broken = await makeHome('{"v":');
    cleanups.push(broken.cleanup);
    const result = hook(broken.files.dir, JSON.stringify(payloads.bash('ls')));
    expect([result.status, result.stdout, result.stderr]).toEqual([0, '', '']);
  });
});

describe.skipIf(!existsSync(BIN))('bundle layout', () => {
  it('keeps Zod out of everything the hook loads at start-up', () => {
    // bin.mjs and its static imports run on every hook call; Zod (~20 ms) must
    // only be in a chunk loaded with import() when the config changes.
    const seen = new Set<string>();
    const visit = (file: string): void => {
      if (seen.has(file)) return;
      seen.add(file);
      const code = readFileSync(file, 'utf8');
      expect(code, file).not.toContain('ZodError');
      for (const [, chunk] of code.matchAll(
        /(?:^|[;\n])import[^;]*?from\s*["'](\.\/[^"']+)["']/g,
      )) {
        if (chunk !== undefined) visit(join(dirname(file), chunk));
      }
    };
    visit(BIN);
    expect(seen.size).toBeGreaterThan(1);
  });
});
