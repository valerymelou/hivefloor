import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exampleOfficeConfig } from '@hivefloor/schema/fixtures';
import { afterEach, describe, expect, it } from 'vitest';
import { HOOK_EVENTS, registeredHooks } from './core/settings.js';
import { payloads } from './test/payloads.js';
import { fakeOffice, makeDirs } from './test/sandbox.js';

// Runs every command through the built bundle against a temporary home folder
// (docs/PRD.md, M3 done criteria). `nx test cli` builds the bundle first.
const BIN = fileURLToPath(new URL('../../../dist/packages/cli/bin.mjs', import.meta.url));
let cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.map((c) => c()));
  cleanups = [];
});

async function sandbox() {
  const dirs = await makeDirs();
  cleanups.push(dirs.cleanup);
  // Async, so fake servers in this test process can answer the child's requests.
  const run = (args: string[], options: { input?: string; cwd?: string } = {}) =>
    new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(process.execPath, [BIN, ...args], {
        cwd: options.cwd ?? join(dirs.home, 'code', 'ledgerly'),
        env: {
          ...process.env,
          HOME: dirs.home,
          USERPROFILE: dirs.home,
          HIVEFLOOR_HOME: dirs.hivefloor,
          CLAUDE_CONFIG_DIR: dirs.claude,
        },
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
      child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
      child.on('error', reject);
      child.on('close', (status) => {
        resolve({ status, stdout, stderr });
      });
      child.stdin.end(options.input ?? '');
    });
  const read = (...path: string[]) => readFileSync(join(...path), 'utf8');
  return { dirs, run, read };
}

describe.skipIf(!existsSync(BIN))('commands (built bundle, temporary home)', () => {
  it('init twice changes nothing the second time', async () => {
    const { dirs, run, read } = await sandbox();
    const first = await run([
      'init',
      '--url',
      'https://office.example.com',
      '--public',
      'Ledgerly',
    ]);
    expect(first.status).toBe(0);
    expect(first.stdout).toContain('New secret created');
    const files = [
      join(dirs.claude, 'settings.json'),
      join(dirs.hivefloor, 'config.json'),
      join(dirs.hivefloor, 'secret'),
    ];
    const before = files.map((file) => read(file));
    const hooks = registeredHooks(JSON.parse(before[0] ?? '{}') as Record<string, unknown>);
    expect(hooks.map((h) => h.event).sort()).toEqual([...HOOK_EVENTS].sort());
    expect(hooks[0]?.command).toContain(BIN);

    const second = await run([
      'init',
      '--url',
      'https://office.example.com',
      '--public',
      'Ledgerly',
    ]);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain('Nothing to change');
    expect(files.map((file) => read(file))).toEqual(before);
    expect(readdirSync(dirs.claude).filter((n) => n.includes('backup'))).toEqual([]);
  });

  it('doctor, preview, pause, resume and uninstall work end to end', async () => {
    const office = await fakeOffice({
      publicProjects: [{ name: 'Ledgerly' }],
      agentTypes: ['Helper'],
    });
    cleanups.push(office.close);
    const { dirs, run, read } = await sandbox();
    expect((await run(['init', '--url', office.url, '--public', 'Ledgerly'])).status).toBe(0);

    const doctor = await run(['doctor']);
    expect(doctor.stdout).toContain('✓ Signed test event');
    expect(doctor.stdout).toContain('"project":"Ledgerly"');
    expect(doctor.status).toBe(0);
    expect(office.received.find((r) => r.path === '/ingest')?.headers['x-office-dry-run']).toBe(
      '1',
    );

    // Use the folder exactly as init recorded it from process.cwd(), which is also
    // what Claude Code reports (real paths on macOS, short names on Windows runners).
    const recorded = JSON.parse(read(dirs.hivefloor, 'config.json')) as {
      projects: { path: string }[];
    };
    const cwd = recorded.projects[0]?.path ?? '';
    const preview = await run(['preview'], {
      input: JSON.stringify({ ...payloads.sessionStart(), cwd }),
    });
    expect(preview.status).toBe(0);
    expect(preview.stdout).toContain('"goal": "Building the paywall screen"');

    expect((await run(['pause'])).status).toBe(0);
    expect(JSON.parse(read(dirs.hivefloor, 'config.json'))).toMatchObject({ paused: true });
    expect((await run(['resume'])).status).toBe(0);
    expect(JSON.parse(read(dirs.hivefloor, 'config.json'))).toMatchObject({ paused: false });

    const uninstall = await run(['uninstall', '--purge']);
    expect(uninstall.status).toBe(0);
    expect(
      registeredHooks(JSON.parse(read(dirs.claude, 'settings.json')) as Record<string, unknown>),
    ).toEqual([]);
    expect(existsSync(dirs.hivefloor)).toBe(false);
  });

  it('deploy validates the office config and calls Wrangler', async () => {
    const { dirs, run } = await sandbox();
    const root = join(dirs.root, 'checkout');
    await mkdir(join(root, 'apps', 'relay'), { recursive: true });
    await mkdir(join(root, 'node_modules', 'wrangler', 'bin'), { recursive: true });
    await writeFile(join(root, 'package.json'), '{}');
    await writeFile(
      join(root, 'node_modules', 'wrangler', 'package.json'),
      '{"name":"wrangler","bin":{"wrangler":"bin/wrangler.js"}}',
    );
    // A stand-in Wrangler that prints the arguments it was given.
    await writeFile(
      join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
      'console.log(JSON.stringify(process.argv.slice(2)));',
    );
    await writeFile(join(root, 'apps', 'relay', 'wrangler.jsonc'), '{}');
    await writeFile(join(root, 'office.config.json'), JSON.stringify(exampleOfficeConfig));
    const result = await run(['deploy', '--dry-run'], { cwd: root });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"deploy"');
    expect(result.stdout).toContain('OFFICE_CONFIG:{');
    expect(result.stdout).toContain('"--dry-run"');
  });

  it('reports usage errors on stderr', async () => {
    const { run } = await sandbox();
    const result = await run(['pause', '--forever']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('hivefloor pause');
  });
});
