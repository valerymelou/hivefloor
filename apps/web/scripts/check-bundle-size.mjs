// Fails when the office's first visit would download more than the budget
// (docs/PRD.md, "Web performance"): scripts, styles, the page, the robot model
// and the two Latin fonts, gzipped. Other font subsets load only when needed.
//
// Usage: node apps/web/scripts/check-bundle-size.mjs [budget in bytes]
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = join(import.meta.dirname, '..', '..', '..', 'dist', 'apps', 'web', 'browser');
const budget = Number(process.argv[2] ?? 1_500_000);

const counted = (path) =>
  /\.(js|css|html|glb)$/.test(path) || /^media\/geist(-mono)?-latin-wght/.test(path);

const files = readdirSync(root, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => relative(root, join(entry.parentPath, entry.name)))
  .filter(counted);

if (files.length === 0) {
  console.error(`No build found in ${root}. Run: pnpm nx build web`);
  process.exit(1);
}

const sizes = files
  .map((path) => ({ path, bytes: gzipSync(readFileSync(join(root, path)), { level: 9 }).length }))
  .sort((a, b) => b.bytes - a.bytes);
const total = sizes.reduce((sum, file) => sum + file.bytes, 0);

const kb = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;
for (const { path, bytes } of sizes) console.log(`${kb(bytes).padStart(10)}  ${path}`);
console.log(`${kb(total).padStart(10)}  total, budget ${kb(budget)}`);

if (total > budget) {
  console.error(`The web build is ${kb(total - budget)} over its budget.`);
  process.exit(1);
}
