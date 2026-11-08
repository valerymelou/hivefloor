import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { exampleOfficeConfig } from '@hivefloor/schema/fixtures';
import { DEMO_MODE } from '../app.config';
import { ConfigStore, DEMO_CONFIG } from './config-store';

function create(demo: boolean): ConfigStore {
  TestBed.configureTestingModule({ providers: [{ provide: DEMO_MODE, useValue: demo }] });
  return TestBed.inject(ConfigStore);
}

describe('ConfigStore', () => {
  it('uses the example office in demo mode without fetching', async () => {
    const store = create(true);
    const fetcher = vi.fn();
    await store.load(fetcher, 'https://x.example/');
    expect(store.config()).toBe(DEMO_CONFIG);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('loads and validates /api/config relative to the base path', async () => {
    const store = create(false);
    const fetcher = vi.fn((_input: URL) => Promise.resolve(Response.json(exampleOfficeConfig)));
    await store.load(fetcher as unknown as typeof fetch, 'https://x.example/office/');
    expect(String(fetcher.mock.calls[0]?.[0] ?? '')).toBe('https://x.example/office/api/config');
    expect(store.config()?.owner).toBe('Valery Melou');
  });

  it('keeps no config when the relay fails or answers nonsense', async () => {
    const store = create(false);
    await store.load(() => Promise.resolve(Response.json({ v: 9 })), 'https://x.example/');
    expect(store.config()).toBeUndefined();
    await store.load(() => Promise.reject(new Error('down')), 'https://x.example/');
    expect(store.config()).toBeUndefined();
  });

  it('shows the example office only while the simulator runs', () => {
    const store = create(false);
    expect(store.config()).toBeUndefined();
    store.useSimulator(true);
    expect(store.config()).toBe(DEMO_CONFIG);
    store.useSimulator(false);
    expect(store.config()).toBeUndefined();
  });
});
