import { mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { signBody } from '../core/sign.js';
import { fakeRelay } from '../test/sandbox.js';
import { realScriptPath, selfCommand, sendEvent } from './sender.js';

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
    expect(selfCommand('/usr/bin/node', '/lib/hivefloor/bin.mjs')).toEqual({
      file: '/usr/bin/node',
      args: ['/lib/hivefloor/bin.mjs'],
    });
  });

  it('runs a compiled binary alone', () => {
    expect(selfCommand('/usr/local/bin/hivefloor', '/$bunfs/root/hivefloor')).toEqual({
      file: '/usr/local/bin/hivefloor',
      args: [],
    });
    expect(selfCommand('/x', undefined)).toEqual({ file: '/x', args: [] });
  });
});

describe('realScriptPath', () => {
  it('follows the symlink a global npm install starts the CLI through', () => {
    const folder = realpathSync(mkdtempSync(join(tmpdir(), 'hivefloor-script-')));
    try {
      const script = join(folder, 'bin.mjs');
      const link = join(folder, 'hivefloor');
      writeFileSync(script, '');
      symlinkSync(script, link);
      expect(realScriptPath(link)).toBe(script);
    } finally {
      rmSync(folder, { recursive: true });
    }
  });

  it("keeps a compiled binary's virtual path, which can't be resolved", () => {
    expect(realScriptPath('/$bunfs/root/hivefloor')).toBe('/$bunfs/root/hivefloor');
  });

  it('has nothing to resolve without a script', () => {
    expect(realScriptPath(undefined)).toBeUndefined();
  });
});
