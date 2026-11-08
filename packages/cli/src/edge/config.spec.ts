import { writeFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { makeHome } from '../test/sandbox.js';
import { loadConfig, loadSecret } from './config.js';
import { readJson } from './files.js';

const valid = { v: 1, endpoint: 'https://office.example.com/ingest' };
let cleanup: (() => Promise<void>) | undefined;
afterEach(() => cleanup?.());

describe('loadConfig', () => {
  it('validates, applies defaults and caches by content', async () => {
    const home = await makeHome(valid);
    cleanup = home.cleanup;
    const config = await loadConfig(home.files);
    expect(config).toMatchObject({
      endpoint: valid.endpoint,
      timestampRoundingSec: 5,
      paused: false,
    });
    expect(await readJson(home.files.configCache)).toMatchObject({
      config: { endpoint: valid.endpoint },
    });
    expect(await loadConfig(home.files)).toEqual(config);
  });

  it('revalidates when the file changes', async () => {
    const home = await makeHome(valid);
    cleanup = home.cleanup;
    await loadConfig(home.files);
    await writeFile(home.files.config, JSON.stringify({ ...valid, paused: true }));
    expect((await loadConfig(home.files))?.paused).toBe(true);
  });

  it.each([
    ['missing', undefined],
    ['not JSON', '{'],
    ['invalid', { v: 1, endpoint: 'http://example.com' }],
  ])('returns nothing for a %s config', async (_label, config) => {
    const home = await makeHome(config);
    cleanup = home.cleanup;
    expect(await loadConfig(home.files)).toBeUndefined();
  });
});

describe('loadSecret', () => {
  it('reads and trims the secret', async () => {
    const home = await makeHome(valid, '  abc  \n');
    cleanup = home.cleanup;
    expect(await loadSecret(home.files)).toBe('abc');
  });

  it('returns nothing when missing or empty', async () => {
    const home = await makeHome(valid, null);
    cleanup = home.cleanup;
    expect(await loadSecret(home.files)).toBeUndefined();
    await writeFile(home.files.secret, '  \n');
    expect(await loadSecret(home.files)).toBeUndefined();
  });
});
