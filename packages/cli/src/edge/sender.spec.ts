import { afterEach, describe, expect, it } from 'vitest';
import { signBody } from '../core/sign.js';
import { fakeRelay } from '../test/sandbox.js';
import { selfCommand, sendEvent } from './sender.js';

let close: (() => Promise<void>) | undefined;
afterEach(() => close?.());

describe('sendEvent (C9)', () => {
  it('POSTs the body with timestamp and signature headers', async () => {
    const relay = await fakeRelay();
    close = relay.close;
    const body = '{"v":1}';
    const status = await sendEvent(body, {
      endpoint: relay.url,
      secret: 's',
      now: () => 1794096000_500,
      fetch,
    });
    expect(status).toBe(204);
    expect(relay.received).toHaveLength(1);
    const [request] = relay.received;
    expect(request?.body).toBe(body);
    expect(request?.headers['x-office-timestamp']).toBe('1794096000');
    expect(request?.headers['x-office-signature']).toBe(signBody('s', 1794096000, body));
    expect(request?.headers['content-type']).toBe('application/json');
  });

  it('never throws on network errors', async () => {
    const failing: typeof fetch = () => Promise.reject(new Error('offline'));
    expect(
      await sendEvent('{}', {
        endpoint: 'https://x.example',
        secret: 's',
        now: Date.now,
        fetch: failing,
      }),
    ).toBeUndefined();
  });
});

describe('selfCommand', () => {
  it('re-runs the script under Node or Bun', () => {
    expect(
      selfCommand('/usr/bin/node', ['/usr/bin/node', '/lib/hivefloor/bin.mjs', 'hook']),
    ).toEqual({
      file: '/usr/bin/node',
      args: ['/lib/hivefloor/bin.mjs'],
    });
  });

  it('runs a compiled binary alone', () => {
    expect(
      selfCommand('/usr/local/bin/hivefloor', ['bun', '/$bunfs/root/hivefloor', 'hook']),
    ).toEqual({
      file: '/usr/local/bin/hivefloor',
      args: [],
    });
    expect(selfCommand('/x', ['x'])).toEqual({ file: '/x', args: [] });
  });
});
