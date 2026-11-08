import { describe, expect, it, vi } from 'vitest';
import { SNAPSHOT } from '../../test/fixtures';
import { LiveSource, type LiveDeps } from './live-source';
import type { ConnectionState } from './source';

class FakeSocket extends EventTarget {
  closed = false;
  constructor(readonly url: string) {
    super();
  }
  open(): void {
    this.dispatchEvent(new Event('open'));
  }
  receive(data: unknown): void {
    this.dispatchEvent(
      new MessageEvent('message', { data: typeof data === 'string' ? data : JSON.stringify(data) }),
    );
  }
  drop(): void {
    this.dispatchEvent(new Event('close'));
  }
  close(): void {
    this.closed = true;
  }
}

function setup(responses: (() => Response)[] = []) {
  const sockets: FakeSocket[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  const states: [ConnectionState, string | undefined][] = [];
  const messages: unknown[] = [];
  const fetch = vi.fn((_input: string | URL) => {
    const next = responses.shift();
    return next === undefined ? Promise.reject(new Error('offline')) : Promise.resolve(next());
  });
  const deps: LiveDeps = {
    baseUrl: 'https://office.example.com/office/',
    createSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
    // The source only ever passes URLs as strings.
    fetch: fetch as unknown as typeof globalThis.fetch,
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
    clearTimeout: vi.fn(),
    random: () => 0.5,
    now: () => Date.UTC(2026, 10, 8, 15, 0),
    timeZone: () => 'Africa/Douala',
  };
  const stop = new LiveSource(deps).start({
    message: (m) => messages.push(m),
    state: (s, until) => states.push([s, until]),
    reset: vi.fn(),
  });
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return { sockets, timers, states, messages, fetch, stop, deps, flush };
}

describe('LiveSource (W6)', () => {
  it('connects to /live under the base path and forwards valid messages', () => {
    const { sockets, states, messages } = setup();
    expect(sockets[0]?.url).toBe('wss://office.example.com/office/live');
    sockets[0]?.open();
    sockets[0]?.receive(SNAPSHOT);
    sockets[0]?.receive('not json');
    sockets[0]?.receive({ type: 'unknown' });
    sockets[0]?.receive(new ArrayBuffer(2));
    expect(states.map(([s]) => s)).toEqual(['connecting', 'live']);
    expect(messages).toHaveLength(1);
  });

  it('shows Reconnecting and retries with backoff after a drop', async () => {
    const { sockets, timers, states, flush } = setup([() => new Response('', { status: 200 })]);
    sockets[0]?.open();
    sockets[0]?.drop();
    await flush();
    expect(states.at(-1)?.[0]).toBe('reconnecting');
    expect(timers[0]?.ms).toBe(750);
    timers[0]?.fn();
    expect(sockets).toHaveLength(2);
    sockets[1]?.drop();
    await flush();
    expect(timers[1]?.ms).toBe(1500);
  });

  it('reports the office closed until the daily reset on a daily-limit answer (H11)', async () => {
    const { sockets, states, timers, flush } = setup([
      () => new Response('error code: 1027', { status: 503 }),
    ]);
    sockets[0]?.drop();
    await flush();
    await flush();
    expect(states.at(-1)).toEqual(['closed', '01:00']);
    // Closed until the reset, so it checks every few minutes, not every 30 s (H12).
    expect(timers[0]?.ms).toBe(210_000);
    timers[0]?.fn();
    expect(sockets).toHaveLength(2);
  });

  it('treats a network error while checking as reconnecting', async () => {
    const { sockets, states, flush } = setup([]);
    sockets[0]?.drop();
    await flush();
    expect(states.at(-1)?.[0]).toBe('reconnecting');
  });

  it('switches to polling the snapshot when the relay is busy (R7, H12)', async () => {
    const { sockets, timers, states, messages, fetch, flush } = setup([
      () => new Response(JSON.stringify(SNAPSHOT), { status: 200 }),
      () => new Response('', { status: 500 }),
    ]);
    sockets[0]?.receive({ type: 'status', v: 1, state: 'busy' });
    await flush();
    expect(states.at(-1)?.[0]).toBe('busy');
    expect(String(fetch.mock.calls[0]?.[0])).toBe('https://office.example.com/office/api/snapshot');
    expect(messages).toHaveLength(1);
    expect(timers[0]?.ms).toBe(210_000);
    sockets[0]?.drop();
    await flush();
    expect(sockets).toHaveLength(1);
    timers[0]?.fn();
    await flush();
    timers[1]?.fn();
    await flush();
    expect(messages).toHaveLength(1);
  });

  it('stops cleanly', async () => {
    const { sockets, timers, stop, deps, flush } = setup([() => new Response('', { status: 200 })]);
    stop();
    expect(sockets[0]?.closed).toBe(true);
    expect(deps.clearTimeout).toHaveBeenCalled();
    sockets[0]?.drop();
    await flush();
    expect(timers).toEqual([]);
  });

  it('uses ws: for http pages', () => {
    const sockets: string[] = [];
    new LiveSource({
      baseUrl: 'http://localhost:8787/',
      createSocket: (url) => {
        sockets.push(url);
        return new FakeSocket(url) as unknown as WebSocket;
      },
      fetch: vi.fn(),
      setTimeout: vi.fn(),
      clearTimeout: vi.fn(),
      random: Math.random,
      now: Date.now,
      timeZone: () => 'UTC',
    }).start({ message: vi.fn(), state: vi.fn(), reset: vi.fn() });
    expect(sockets).toEqual(['ws://localhost:8787/live']);
  });
});
