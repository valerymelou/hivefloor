import { describe, expect, it } from 'vitest';
import { CONFIG, event, ingestRequest, NOW, sign, SECRET } from '../../test/helpers.js';
import {
  EVENT_TIME_SLACK_SEC,
  isAllowed,
  readLimited,
  REJECTION_STATUS,
  verifyIngest,
  verifySignature,
} from './verify.js';

const verify = async (
  body: unknown,
  options: Parameters<typeof ingestRequest>[1] = {},
  config = CONFIG,
) => verifyIngest(await ingestRequest(body, { timestamp: NOW, ...options }), SECRET, config, NOW);

describe('verifyIngest (R1)', () => {
  it('accepts a signed, valid, allowed event', async () => {
    const result = await verify(event());
    expect(result).toMatchObject({
      ok: true,
      dryRun: false,
      hidden: false,
      event: { sid: 'a9f3c2', project: 'Ledgerly' },
    });
  });

  it('flags dry runs and hidden private events (H3)', async () => {
    expect(await verify(event(), { dryRun: true })).toMatchObject({ ok: true, dryRun: true });
    const hidden = { ...CONFIG, privateRoom: { ...CONFIG.privateRoom, visible: false } };
    expect(await verify(event({ project: undefined }), {}, hidden)).toMatchObject({
      ok: true,
      hidden: true,
    });
  });

  it.each([
    ['a timestamp 61 s old', { timestamp: NOW - 61 }, 'unauthorized'],
    ['a timestamp 61 s ahead', { timestamp: NOW + 61 }, 'unauthorized'],
    ['a wrong secret', { secret: 'another-secret-0123456789' }, 'unauthorized'],
    ['a malformed signature', { signature: 'zz' }, 'unauthorized'],
  ] as const)('rejects %s', async (_label, options, reason) => {
    expect(await verify(event(), options)).toEqual({ ok: false, reason });
  });

  it('rejects a missing timestamp header', async () => {
    const request = await ingestRequest(event(), { timestamp: NOW });
    request.headers.delete('x-office-timestamp');
    expect(await verifyIngest(request, SECRET, CONFIG, NOW)).toEqual({
      ok: false,
      reason: 'unauthorized',
    });
  });

  it.each([
    ['broken JSON', '{"v":1'],
    ['an unknown field', { ...event(), cwd: '/home/ada/client' }],
    ['an event time too old', event({ t: NOW - EVENT_TIME_SLACK_SEC - 1 })],
    ['an event time in the future', event({ t: NOW + 61 })],
  ])('rejects %s as invalid', async (_label, body) => {
    expect(await verify(body)).toEqual({ ok: false, reason: 'invalid' });
  });

  it.each([
    ['an unknown project', event({ project: 'Acme Bank' })],
    ['an unknown agent type', event({ aid: '4be1d0', role: 'Spy', kind: 'spawn', cat: undefined })],
  ])('rejects %s as not allowed (second gate)', async (_label, body) => {
    expect(await verify(body)).toEqual({ ok: false, reason: 'not-allowed' });
  });

  it('rejects bodies over 2 KB, with or without Content-Length', async () => {
    const big = { ...event(), goal: 'x'.repeat(3000) };
    expect(await verify(big)).toEqual({ ok: false, reason: 'too-large' });
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(1500));
        controller.enqueue(new Uint8Array(1500));
        controller.close();
      },
    });
    const request = new Request('https://x.example/ingest', {
      method: 'POST',
      body: stream,
      duplex: 'half',
    } as RequestInit);
    expect(await readLimited(request, 2048)).toBeUndefined();
    expect(await readLimited(new Request('https://x.example/', { method: 'POST' }), 2048)).toBe('');
  });

  it('maps every rejection to a bare status code in one place', () => {
    expect(REJECTION_STATUS).toEqual({
      'too-large': 413,
      unauthorized: 401,
      invalid: 400,
      'not-allowed': 422,
      replay: 409,
      unavailable: 503,
    });
  });
});

describe('signatures', () => {
  it('verifies HMAC-SHA256 of timestamp.body', async () => {
    const signature = await sign('{"a":1}', 1794096000);
    expect(await verifySignature(SECRET, '1794096000', '{"a":1}', signature)).toBe(true);
    expect(await verifySignature(SECRET, '1794096001', '{"a":1}', signature)).toBe(false);
    expect(await verifySignature(SECRET, '1794096000', '{"a":2}', signature)).toBe(false);
    expect(await verifySignature(SECRET, '1794096000', '{"a":1}', signature.toUpperCase())).toBe(
      false,
    );
  });
});

describe('isAllowed', () => {
  it('allows claude, listed agent types and listed projects', () => {
    expect(isAllowed(event(), CONFIG)).toBe(true);
    expect(isAllowed(event({ project: undefined }), CONFIG)).toBe(true);
    expect(
      isAllowed(event({ aid: '4be1d0', role: 'Explore', kind: 'spawn', cat: undefined }), CONFIG),
    ).toBe(true);
    expect(isAllowed(event({ project: 'ledgerly' }), CONFIG)).toBe(false);
  });
});
