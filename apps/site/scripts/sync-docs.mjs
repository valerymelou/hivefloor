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
  { slug: 'self-hosting', description: "About 10 minutes, on Cloudflare's free plan." },
  { slug: 'configuration', description: 'The two config files, and what goes in each.' },
  { slug: 'configuration-reference', description: 'Every field, generated from the schemas.' },
  { slug: 'troubleshooting', description: 'What to check when a robot is missing.' },
  { slug: 'privacy', description: 'What leaves your machine, and what never does.' },
  { slug: 'hooks', description: 'How Hivefloor learns what Claude Code is doing.' },
  { slug: 'character-sets', description: 'Swap the robots for your own model.' },
  { slug: 'architecture', description: 'The CLI, the relay and the office, and how they fit.' },
];
const SLUGS = GUIDES.map((guide) => guide.slug);

const rewriteLink = (target) => {
  if (/^([a-z]+:|#)/.test(target)) return target;
  const [path = '', anchor] = target.split('#');
  const guide = path.replace(/\.md$/, '');
  if (SLUGS.includes(guide)) return `/docs/${guide}${anchor === undefined ? '' : `#${anchor}`}`;
  return `${GITHUB}/${target}`;
};

const convert = (text) =>
  text
    // The page's banner shows the title.
    .replace(/^# .+\n+/, '')
    .replace(/^## (\d+)\. (.+)$/gm, '## <span class="hf-step">$1</span> $2')
    .replace(/\]\(([^)\s]+)\)/g, (_, target) => `](${rewriteLink(target)})`)
    // Mermaid would need a large script on every guide; GitHub draws it.
    .replace(
      /```mermaid\n[\s\S]*?```/g,
      '> A diagram goes here. [See it on GitHub](' + `${GITHUB}/architecture.md).`,
    );

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
GUIDES.forEach(({ slug, description }, order) => {
  const text = readFileSync(join(root, 'docs', `${slug}.md`), 'utf8');
  const title = /^# (.+)$/m.exec(text)?.[1] ?? slug;
  const front = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    `slug: ${slug}`,
    `order: ${String(order)}`,
    '---',
    '',
    '',
  ].join('\n');
  writeFileSync(join(output, `${slug}.md`), front + convert(text));
});
console.log(`Synced ${String(GUIDES.length)} guides to ${output}`);
