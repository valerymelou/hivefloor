import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hivefloorFiles, type HivefloorFiles } from '../edge/home.js';
import { SECRET } from './payloads.js';

/** A temporary HIVEFLOOR_HOME with a config and a secret. */
export async function makeHome(
  config: Record<string, unknown> | string | undefined,
  secret: string | null = SECRET,
): Promise<{
  files: HivefloorFiles;
  cleanup: () => Promise<void>;
}> {
  const dir = await mkdtemp(join(tmpdir(), 'hivefloor-test-'));
  const files = hivefloorFiles({ HIVEFLOOR_HOME: dir }, '/Users/ada', false);
  await mkdir(dir, { recursive: true });
  if (config !== undefined)
    await writeFile(files.config, typeof config === 'string' ? config : JSON.stringify(config));
  if (secret !== null) await writeFile(files.secret, `${secret}\n`);
  return { files, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

/** A received request. */
export interface Received {
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
}

/** A local fake relay that records requests and answers 204. */
export async function fakeRelay(
  status = 204,
): Promise<{ url: string; received: Received[]; close: () => Promise<void> }> {
  const received: Received[] = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk: Buffer) => (body += chunk.toString()));
    request.on('end', () => {
      received.push({ headers: request.headers, body });
      response.writeHead(status).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}/ingest`,
    received,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

/** A fake relay that serves `/api/config` and records `/ingest` requests. */
export async function fakeOffice(
  office: unknown,
  options: { ingestStatus?: number; configStatus?: number; date?: string } = {},
): Promise<{ url: string; received: (Received & { path: string })[]; close: () => Promise<void> }> {
  const received: (Received & { path: string })[] = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk: Buffer) => (body += chunk.toString()));
    request.on('end', () => {
      received.push({ headers: request.headers, body, path: request.url ?? '' });
      const date = options.date ?? new Date().toUTCString();
      if (request.method === 'GET' && request.url === '/api/config') {
        response
          .writeHead(options.configStatus ?? 200, { 'content-type': 'application/json', date })
          .end(JSON.stringify(office));
      } else if (request.method === 'POST' && request.url === '/ingest') {
        response.writeHead(options.ingestStatus ?? 204, { date }).end();
      } else {
        response.writeHead(404).end();
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}`,
    received,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

/** Temporary folders for a command test: a home, Hivefloor's folder and Claude's folder. */
export async function makeDirs(): Promise<{
  root: string;
  home: string;
  hivefloor: string;
  claude: string;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(join(tmpdir(), 'hivefloor-cmd-'));
  const home = join(root, 'home');
  const dirs = {
    root,
    home,
    hivefloor: join(home, '.config', 'hivefloor'),
    claude: join(home, '.claude'),
  };
  await mkdir(join(home, 'code', 'ledgerly'), { recursive: true });
  return { ...dirs, cleanup: () => rm(root, { recursive: true, force: true }) };
}
