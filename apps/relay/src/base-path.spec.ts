import { describe, expect, it } from 'vitest';
import { withoutBasePath } from './base-path.js';

const request = (path: string) => new Request(`https://office.example.com${path}`);
const pathOf = (r: Request) => new URL(r.url).pathname;

describe('withoutBasePath', () => {
  it('leaves requests alone at the root', () => {
    const original = request('/live');
    expect(withoutBasePath(original, undefined)).toBe(original);
    expect(withoutBasePath(original, '')).toBe(original);
    expect(withoutBasePath(original, '/')).toBe(original);
  });

  it('removes the base path', () => {
    expect(pathOf(withoutBasePath(request('/office/live'), '/office'))).toBe('/live');
    expect(pathOf(withoutBasePath(request('/office/api/config'), '/office/'))).toBe('/api/config');
    expect(pathOf(withoutBasePath(request('/office'), '/office'))).toBe('/');
  });

  it('keeps the query, method, headers and body', async () => {
    const original = new Request('https://office.example.com/office/ingest?a=1', {
      method: 'POST',
      headers: { 'x-office-timestamp': '123' },
      body: 'payload',
    });
    const result = withoutBasePath(original, '/office');
    expect(new URL(result.url).search).toBe('?a=1');
    expect(result.method).toBe('POST');
    expect(result.headers.get('x-office-timestamp')).toBe('123');
    expect(await result.text()).toBe('payload');
  });

  it('ignores paths that only start with the same letters', () => {
    const original = request('/officer/live');
    expect(withoutBasePath(original, '/office')).toBe(original);
  });
});
