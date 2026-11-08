// Copies the guides in docs/ into the site's content folder, so the docs have one
// source. Adds the front matter Analog needs, points links between guides at
// their pages, and everything else at GitHub.
//
// Usage: node apps/site/scripts/sync-docs.mjs
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..', '..');
const output = join(import.meta.dirname, '..', 'src', 'content', 'docs');
const GITHUB = 'https://github.com/valerymelou/hivefloor/blob/main/docs';

const GUIDES = [
  'self-hosting',
  'configuration',
  'configuration-reference',
  'troubleshooting',
  'privacy',
  'hooks',
  'character-sets',
  'architecture',
];

const rewriteLink = (target) => {
  if (/^([a-z]+:|#)/.test(target)) return target;
  const [path = '', anchor] = target.split('#');
  const guide = path.replace(/\.md$/, '');
  if (GUIDES.includes(guide)) return `/docs/${guide}${anchor === undefined ? '' : `#${anchor}`}`;
  return `${GITHUB}/${target}`;
};

const convert = (text) =>
  text
    .replace(/\]\(([^)\s]+)\)/g, (_, target) => `](${rewriteLink(target)})`)
    // Mermaid would need a large script on every guide; GitHub draws it.
    .replace(
      /```mermaid\n[\s\S]*?```/g,
      '> A diagram goes here. [See it on GitHub](' + `${GITHUB}/architecture.md).`,
    );

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
GUIDES.forEach((slug, order) => {
  const text = readFileSync(join(root, 'docs', `${slug}.md`), 'utf8');
  const title = /^# (.+)$/m.exec(text)?.[1] ?? slug;
  const front = `---\ntitle: ${JSON.stringify(title)}\nslug: ${slug}\norder: ${String(order)}\n---\n\n`;
  writeFileSync(join(output, `${slug}.md`), front + convert(text));
});
console.log(`Synced ${String(GUIDES.length)} guides to ${output}`);
