// Builds the folder the maintainer's Worker serves: the site at /, and the office
// at /office/. Self-hosters don't need this; their office is served at /.
//
// Usage: pnpm nx run site:assemble
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, sep } from 'node:path';

const SITE_URL = 'https://hivefloor.valerymelou.com';
const root = join(import.meta.dirname, '..', '..', '..');
const site = join(root, 'apps', 'site', 'dist', 'analog', 'public');
const office = join(root, 'dist', 'apps', 'web-office', 'browser');
const output = join(root, 'dist', 'site-deploy');

for (const [name, path] of [
  ['site', site],
  ['office', office],
]) {
  if (!existsSync(path)) {
    console.error(`No ${name} build in ${path}.`);
    process.exit(1);
  }
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(site, output, { recursive: true });
cpSync(office, join(output, 'office'), { recursive: true });
rmSync(join(output, 'office', '_headers'));

const htmlFiles = readdirSync(site, { recursive: true, withFileTypes: true }).filter(
  (entry) => entry.isFile() && entry.name.endsWith('.html'),
);

/** Every pre-rendered page in the site. */
const pages = htmlFiles.map((entry) => readFileSync(join(entry.parentPath, entry.name), 'utf8'));

// Cloudflare serves each page at its folder's address, with a trailing slash.
const addresses = htmlFiles
  .filter((entry) => entry.name === 'index.html')
  .map((entry) => relative(site, entry.parentPath).split(sep).join('/'))
  .map((folder) => `${SITE_URL}/${folder === '' ? '' : `${folder}/`}`)
  .sort();
writeFileSync(
  join(output, 'sitemap.xml'),
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...addresses.map((address) => `  <url><loc>${address}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n'),
);

// Angular's pre-rendered pages carry two small inline scripts. Allow exactly
// those by hash, so the site's policy stays strict.
const hashes = new Set();
for (const page of pages) {
  for (const [, attributes, body] of page.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script[^>]*>/gi,
  )) {
    if (/\bsrc=/i.test(attributes) || /application\/(ld\+)?json/i.test(attributes)) continue;
    hashes.add(`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  }
}

const lines = readFileSync(join(office, '_headers'), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith(' '));
const siteLines = lines.map((line) =>
  line.includes('Content-Security-Policy')
    ? line.replace("script-src 'self'", `script-src 'self' ${[...hashes].join(' ')}`)
    : line,
);
const block = (path, body) => [path, ...body, ''].join('\n');

// Cloudflare applies every matching rule and joins the values, so a "/*" rule
// would stack on top of the office's: each path gets exactly one rule.
writeFileSync(
  join(output, '_headers'),
  [
    // The office is a live view with nothing to index; the site is what should rank.
    block('/office/*', [...lines, '  X-Robots-Tag: noindex']),
    ...[
      '/',
      '/docs',
      '/docs/*',
      '/assets/*',
      '/favicon.ico',
      '/favicon.svg',
      '/robots.txt',
      '/sitemap.xml',
    ].map((path) => block(path, siteLines)),
  ].join('\n'),
);
console.log(`Assembled ${output}, with ${String(hashes.size)} inline script hashes.`);
