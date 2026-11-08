import { afterEach, describe, expect, it } from 'vitest';
import { commandSandbox } from '../test/setup.js';
import { setPaused } from './pause.js';

let cleanup: (() => Promise<void>) | undefined;
afterEach(() => cleanup?.());

describe('hivefloor pause and resume (C12)', () => {
  it('sets and clears paused, keeping the rest of the file', async () => {
    const box = await commandSandbox();
    cleanup = box.cleanup;
    await box.seed({
      v: 1,
      endpoint: 'https://office.example.com/ingest',
      timestampRoundingSec: 10,
    });
    const paused = box.io();
    expect(await setPaused(true, [], paused.io)).toBe(0);
    expect(paused.out()).toContain('Paused');
    expect(await box.readJson(box.paths.config)).toEqual({
      v: 1,
      endpoint: 'https://office.example.com/ingest',
      timestampRoundingSec: 10,
      paused: true,
    });
    expect(await setPaused(true, [], box.io().io)).toBe(0);
    expect(await setPaused(false, [], box.io().io)).toBe(0);
    expect((await box.readJson(box.paths.config))['paused']).toBe(false);
  });

  it('fails without a config or with an invalid one', async () => {
    const box = await commandSandbox();
    cleanup = box.cleanup;
    const missing = box.io();
    expect(await setPaused(true, [], missing.io)).toBe(1);
    expect(missing.err()).toContain('Run hivefloor init');
    await box.seed({ v: 1, endpoint: 'nope' });
    const invalid = box.io();
    expect(await setPaused(true, [], invalid.io)).toBe(1);
    expect(invalid.err()).toContain('endpoint');
  });

  it('rejects unknown flags', async () => {
    const box = await commandSandbox();
    cleanup = box.cleanup;
    await expect(setPaused(true, ['--now'], box.io().io)).rejects.toThrow();
  });
});
