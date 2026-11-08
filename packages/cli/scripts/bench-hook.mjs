// Measures `hivefloor hook` end to end, as Claude Code runs it: a new process per
// hook call reading one payload from stdin. Fails when p95 exceeds the budget
// (docs/PRD.md: hook overhead p95 under 50 ms).
//
// Usage: node scripts/bench-hook.mjs [path-to-binary]
//   HIVEFLOOR_BENCH_RUNS (default 60), HIVEFLOOR_BENCH_BUDGET_MS (default 50)
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const runs = Number(process.env.HIVEFLOOR_BENCH_RUNS ?? 60);
const budget = Number(process.env.HIVEFLOOR_BENCH_BUDGET_MS ?? 50);
const target = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(import.meta.dirname, '../../../dist/packages/cli/bin.mjs');
const command = target.endsWith('.mjs') ? [process.execPath, target] : [target];

const home = mkdtempSync(join(tmpdir(), 'hivefloor-bench-'));
writeFileSync(
  join(home, 'config.json'),
  JSON.stringify({
    v: 1,
    // Nothing listens on port 9: the detached sender fails fast and silently.
    endpoint: 'http://127.0.0.1:9/ingest',
    projects: [{ path: home, public: true, name: 'Bench' }],
  }),
);
writeFileSync(join(home, 'secret'), 'bench-secret');

const tools = ['Read', 'Edit', 'Bash', 'Grep', 'WebSearch', 'Write'];
const payload = (i) =>
  JSON.stringify({
    session_id: 'bench-session',
    transcript_path: '/tmp/t.jsonl',
    cwd: home,
    hook_event_name: 'PreToolUse',
    tool_name: tools[i % tools.length],
    tool_input: { command: 'pnpm test', file_path: '/tmp/x.ts' },
  });

const env = { ...process.env, HIVEFLOOR_HOME: home };
const runOnce = (i) => {
  const started = process.hrtime.bigint();
  const result = spawnSync(command[0], [...command.slice(1), 'hook'], { input: payload(i), env });
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  if (result.status !== 0 || result.stdout.length > 0)
    throw new Error(`hook misbehaved: exit ${result.status}, stdout ${result.stdout.length} bytes`);
  return ms;
};

try {
  for (let i = 0; i < 5; i++) runOnce(i); // warm the file cache and the config cache
  const times = Array.from({ length: runs }, (_, i) => runOnce(i)).sort((a, b) => a - b);
  const at = (p) => times[Math.min(times.length - 1, Math.ceil((p / 100) * times.length) - 1)];
  const summary = `hook over ${runs} runs: p50 ${at(50).toFixed(1)} ms, p95 ${at(95).toFixed(1)} ms, max ${at(100).toFixed(1)} ms (budget p95 < ${budget} ms)`;
  console.log(summary);
  if (at(95) >= budget) {
    console.error('Hook benchmark over budget.');
    process.exitCode = 1;
  }
} finally {
  rmSync(home, { recursive: true, force: true });
}
