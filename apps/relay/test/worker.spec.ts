import { env, exports } from 'cloudflare:workers';
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import {
  SnapshotMessageSchema,
  ViewerMessageSchema,
  type IngestEventInput,
} from '@hivefloor/schema';
import { afterEach, describe, expect, it } from 'vitest';
import { OFFICE_NAME } from '../src/env.js';
import worker from '../src/index.js';
import type { Office } from '../src/office.js';
import { load, persist } from '../src/state/store.js';
import { event, ingestRequest } from './helpers.js';

const now = () => Math.floor(Date.now() / 1000);
const live = (overrides: Partial<IngestEventInput> = {}) => event({ t: now(), ...overrides });
const office = () => env.OFFICE.getByName(OFFICE_NAME);
const send = async (body: unknown, options: Parameters<typeof ingestRequest>[1] = {}) =>
  exports.default.fetch(await ingestRequest(body, options));
let seq = 100;
const next = () => ++seq;

const sockets: WebSocket[] = [];
afterEach(() => {
  for (const socket of sockets.splice(0)) socket.close(1000, 'done');
});

async function connect(): Promise<{
  socket: WebSocket;
  messages: unknown[];
  wait: (n: number) => Promise<void>;
}> {
  const response = await exports.default.fetch('https://office.example.com/live', {
    headers: { upgrade: 'websocket' },
  });
  expect(response.status).toBe(101);
  const socket = response.webSocket;
  if (socket === null) throw new Error('no socket');
  const messages: unknown[] = [];
  socket.addEventListener('message', (e) => messages.push(JSON.parse(String(e.data))));
  socket.accept();
  sockets.push(socket);
  const wait = async (n: number) => {
    for (let i = 0; i < 100 && messages.length < n; i++)
      await new Promise((r) => setTimeout(r, 10));
  };
  return { socket, messages, wait };
}

describe('POST /ingest', () => {
  it('applies a verified event and answers 204 with no body', async () => {
    const response = await send(live({ seq: next(), goal: 'Building the paywall screen' }));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    const snapshot = await office().snapshot(Date.now());
    expect(snapshot.robots.find((r) => r.key === 'a9f3c2')).toMatchObject({
      room: 'ledgerly',
      goal: 'Building the paywall screen',
      status: 'working',
    });
  });

  it.each([
    ['a bad signature', {}, { signature: '0'.repeat(64) }, 401],
    ['a stale timestamp', {}, { timestamp: Math.floor(Date.now() / 1000) - 120 }, 401],
    ['an unknown project', { project: 'Acme Bank' }, {}, 422],
    ['an extra field', { cwd: '/home/ada' }, {}, 400],
  ] as const)('answers %s with a bare %s', async (_label, overrides, options, status) => {
    const response = await send({ ...live({ seq: next() }), ...overrides }, options);
    expect(response.status).toBe(status);
    expect(await response.text()).toBe('');
  });

  it('answers 413 for a body over 2 KB', async () => {
    expect((await send('x'.repeat(3000))).status).toBe(413);
  });

  it('rejects a replayed request within 60 s (R2)', async () => {
    const body = JSON.stringify(live({ sid: 'e00000', seq: next() }));
    const timestamp = now();
    expect((await send(body, { timestamp })).status).toBe(204);
    expect((await send(body, { timestamp })).status).toBe(409);
  });

  it('verifies a dry run without changing the office (ADR 0012)', async () => {
    const response = await send(live({ sid: 'd00000', seq: next() }), { dryRun: true });
    expect(response.status).toBe(204);
    expect((await office().snapshot(Date.now())).robots.some((r) => r.key === 'd00000')).toBe(
      false,
    );
    expect(
      (await send(live({ sid: 'd00000', seq: next(), project: 'Nope' }), { dryRun: true })).status,
    ).toBe(422);
  });
});

describe('GET /api', () => {
  it('serves the public office config, cached', async () => {
    const response = await exports.default.fetch('https://office.example.com/api/config');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=60');
    expect(Date.parse(response.headers.get('date') ?? '')).toBeGreaterThan(0);
    const body: Record<string, unknown> = await response.json();
    expect(body).toMatchObject({
      owner: 'Valery Melou',
      agentTypes: ['Explore', 'Plan', 'Helper', 'code-reviewer'],
    });
    expect(body).not.toHaveProperty('$schema');
  });

  it('serves a schema-valid snapshot cached for 5 s', async () => {
    await send(live({ sid: 'f00000', seq: next() }));
    const response = await exports.default.fetch('https://office.example.com/api/snapshot');
    expect(response.headers.get('cache-control')).toBe('public, max-age=5');
    const snapshot: unknown = await response.json();
    expect(SnapshotMessageSchema.safeParse(snapshot).success).toBe(true);
  });

  it('serves the same routes under a base path', async () => {
    const context = {
      waitUntil: () => undefined,
      passThroughOnException: () => undefined,
      props: {},
    };
    const at = (path: string, basePath?: string) =>
      worker.fetch(
        new Request(`https://office.example.com${path}`),
        basePath === undefined ? env : { ...env, BASE_PATH: basePath },
        context as unknown as ExecutionContext,
      );
    expect((await at('/office/api/config', '/office')).status).toBe(200);
    expect((await at('/api/config')).status).toBe(200);
    expect((await at('/office/api/config')).status).toBe(404);
  });

  it('answers unknown routes and plain GETs of /live with bare status codes', async () => {
    expect((await exports.default.fetch('https://office.example.com/api/nope')).status).toBe(404);
    expect((await exports.default.fetch('https://office.example.com/live')).status).toBe(426);
  });
});

describe('GET /live (R4, R7)', () => {
  it('sends a snapshot on connect, then a delta per change', async () => {
    const viewer = await connect();
    await viewer.wait(1);
    expect(viewer.messages[0]).toMatchObject({ type: 'snapshot', v: 1 });
    await send(live({ sid: 'aa0000', seq: next(), cat: 'testing' }));
    await viewer.wait(2);
    const delta = viewer.messages.find((m) => (m as { type?: string }).type === 'delta');
    expect(delta).toMatchObject({
      type: 'delta',
      robot: { key: 'aa0000', cat: 'testing', status: 'working' },
    });
    for (const message of viewer.messages)
      expect(ViewerMessageSchema.safeParse(message).success).toBe(true);
  });

  it('gives visitors beyond the viewer cap a busy status (H12)', async () => {
    await connect();
    await connect();
    const extra = await connect();
    await extra.wait(1);
    expect(extra.messages).toEqual([{ type: 'status', v: 1, state: 'busy' }]);
  });
});

describe('Office Durable Object', () => {
  it('schedules presence alarms only while robots are present (R5)', async () => {
    await send(live({ sid: 'bb0000', seq: next() }));
    const alarm = await runInDurableObject(office(), (_instance: Office, state) =>
      state.storage.getAlarm(),
    );
    expect(alarm).toBeGreaterThan(Date.now());
    expect(await runDurableObjectAlarm(office())).toBe(true);
  });

  it('keeps the office across eviction', async () => {
    await send(live({ sid: 'cc0000', seq: next() }));
    await evictDurableObject(office());
    expect((await office().snapshot(Date.now())).robots.some((r) => r.key === 'cc0000')).toBe(true);
  });

  it('writes only the rows that changed', async () => {
    await runInDurableObject(office(), (_instance: Office, state) => {
      const before = load(state.storage.sql, '2026-11-08');
      const robot = before.robots[0];
      if (robot === undefined) throw new Error('expected a robot');
      const after = {
        ...before,
        robots: [{ ...robot, lastSeq: robot.lastSeq + 1 }, ...before.robots.slice(1)],
      };
      expect(persist(state.storage.sql, before, after)).toBe(1);
      expect(persist(state.storage.sql, after, after)).toBe(0);
      const byKey = (a: { key: string }, b: { key: string }) => a.key.localeCompare(b.key);
      const reloaded = load(state.storage.sql, '2026-11-08');
      expect([...reloaded.robots].sort(byKey)).toEqual([...after.robots].sort(byKey));
      expect(reloaded.rooms.length).toBe(after.rooms.length);
    });
  });
});
