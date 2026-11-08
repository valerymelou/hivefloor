// Serves the built office app (dist/apps/web/browser) for the end-to-end tests,
// with the response headers from its _headers file, so the tests run under the
// same Content-Security-Policy as production. Unknown paths get index.html.
//
// Usage: node apps/web-e2e/scripts/serve.mjs   (PORT defaults to 4317)
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';

const root = join(import.meta.dirname, '..', '..', '..', 'dist', 'apps', 'web', 'browser');
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

/** Reads the `/*` block of a Cloudflare `_headers` file. */
async function readHeaders() {
  const text = await readFile(join(root, '_headers'), 'utf8');
  const headers = {};
  let inBlock = false;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    if (!line.startsWith(' ')) {
      inBlock = line.trim() === '/*';
      continue;
    }
    if (!inBlock) continue;
    const at = line.indexOf(':');
    headers[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return headers;
}

const headers = await readHeaders();

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
  const body = asset ?? (await file(join(root, 'index.html')));
  const type =
    asset === undefined ? TYPES['.html'] : (TYPES[extname(wanted)] ?? 'application/octet-stream');
  response.writeHead(body === undefined ? 404 : 200, { ...headers, 'Content-Type': type });
  response.end(body);
}).listen(port, () => {
  console.log(`Serving ${root} on http://localhost:${String(port)}`);
});
