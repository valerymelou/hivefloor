import { describe, expect, it } from 'vitest';
import { app } from './app.js';
import type { Env } from './env.js';

/** An environment whose Durable Object fails every call with `message`. */
function failing(message: string): Env {
  const fail = () => Promise.reject(new Error(message));
  return { OFFICE: { getByName: () => ({ snapshot: fail, fetch: fail }) } } as unknown as Env;
}

const LIMIT = 'Exceeded allowed volume of requests in Durable Objects free tier.';

describe('Durable Object failures', () => {
  it('answers 429 when the free tier limit is used up, so the page shows "Office closed"', async () => {
    const snapshot = await app.request('/api/snapshot', {}, failing(LIMIT));
    expect(snapshot.status).toBe(429);
    const live = await app.request('/live', { headers: { upgrade: 'websocket' } }, failing(LIMIT));
    expect(live.status).toBe(429);
  });

  it('answers 500 for any other failure', async () => {
    const response = await app.request('/api/snapshot', {}, failing('boom'));
    expect(response.status).toBe(500);
  });
});
