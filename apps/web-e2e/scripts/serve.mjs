// Serves the built office app (dist/apps/web/browser) for the end-to-end tests,
// with the response headers from its _headers file, so the tests run under the
// same Content-Security-Policy as production. Unknown paths get index.html.
//
// Usage: node apps/web-e2e/scripts/serve.mjs   (PORT defaults to 4317)
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';

const dist = join(import.meta.dirname, '..', '..', '..', 'dist');
const root = join(dist, process.env['SERVE_DIR'] ?? join('apps', 'web', 'browser'));
const port = Number(process.env['PORT'] ?? 4317);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
};

/** Reads a Cloudflare `_headers` file into its rules. */
async function readRules() {
  const text = await readFile(join(root, '_headers'), 'utf8');
  const rules = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    if (!line.startsWith(' ')) {
      rules.push({ path: line.trim(), headers: {} });
      continue;
    }
    const at = line.indexOf(':');
    const rule = rules.at(-1);
    if (rule !== undefined) rule.headers[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return rules;
}

const rules = await readRules();

/** The headers for a path, from every rule that matches it, as Cloudflare does. */
function headersFor(path) {
  const matching = rules.filter((rule) =>
    rule.path.endsWith('*') ? path.startsWith(rule.path.slice(0, -1)) : path === rule.path,
  );
  return Object.assign({}, ...matching.map((rule) => rule.headers));
}

async function file(path) {
  try {
    return await readFile(path);
  } catch {
    return undefined;
  }
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const wanted = normalize(join(root, decodeURIComponent(url.pathname)));
  const safe = wanted === root || wanted.startsWith(root + sep);
  const asset = safe && extname(wanted) !== '' ? await file(wanted) : undefined;
  // Pre-rendered pages live at <path>/index.html; anything else gets the root page.
  const page = safe && asset === undefined ? await file(join(wanted, 'index.html')) : undefined;
  const body = asset ?? page ?? (await file(join(root, 'index.html')));
  const type =
    asset === undefined ? TYPES['.html'] : (TYPES[extname(wanted)] ?? 'application/octet-stream');
  response.writeHead(body === undefined ? 404 : 200, {
    ...headersFor(url.pathname),
    'Content-Type': type,
  });
  response.end(body);
}).listen(port, () => {
  console.log(`Serving ${root} on http://localhost:${String(port)}`);
});
