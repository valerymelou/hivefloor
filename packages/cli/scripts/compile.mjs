// Compiles the bundle into standalone executables with `bun build --compile`
// (docs/adr/0011-compiled-binary-with-bun.md), so owners don't need Node (H1).
// Bun is a build tool only; it never becomes a runtime dependency.
//
// Usage: node scripts/compile.mjs [target ...]   (default: every target)
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const TARGETS = ['linux-x64', 'linux-arm64', 'darwin-x64', 'darwin-arm64', 'windows-x64'];
const dist = resolve(import.meta.dirname, '../../../dist/packages/cli');
const out = join(dist, 'binaries');
const bun = process.env.BUN ?? 'bun';
const targets = process.argv.length > 2 ? process.argv.slice(2) : TARGETS;

mkdirSync(out, { recursive: true });
for (const target of targets) {
  if (!TARGETS.includes(target))
    throw new Error(`Unknown target ${target}. Known: ${TARGETS.join(', ')}`);
  const file = join(out, `hivefloor-${target}${target.startsWith('windows') ? '.exe' : ''}`);
  execFileSync(
    bun,
    [
      'build',
      join(dist, 'bin.mjs'),
      '--compile',
      '--minify',
      `--target=bun-${target}`,
      '--outfile',
      file,
    ],
    {
      stdio: 'inherit',
    },
  );
}
