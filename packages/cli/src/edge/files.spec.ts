import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readJson, removeWithPrefix, writeAtomic } from './files.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'hivefloor-files-'));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe('files', () => {
  it('writes atomically with private permissions and reads back', async () => {
    const path = join(dir, 'nested', 'a.json');
    await writeAtomic(path, '{"a":1}');
    expect(await readJson(path)).toEqual({ a: 1 });
    expect(await readdir(join(dir, 'nested'))).toEqual(['a.json']);
    if (process.platform !== 'win32') expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it('cleans up the temporary file when the rename fails', async () => {
    const target = join(dir, 'is-a-dir');
    await writeAtomic(join(target, 'x.json'), '{}');
    await expect(writeAtomic(target, '{}')).rejects.toThrow();
    expect((await readdir(dir)).filter((n) => n.endsWith('.tmp'))).toEqual([]);
  });

  it('reads missing or broken files as undefined', async () => {
    expect(await readJson(join(dir, 'missing.json'))).toBeUndefined();
    await writeAtomic(join(dir, 'bad.json'), '{');
    expect(await readJson(join(dir, 'bad.json'))).toBeUndefined();
  });

  it('removes files by prefix only', async () => {
    await writeAtomic(join(dir, 'abc.json'), '1');
    await writeAtomic(join(dir, 'abc.def.json'), '2');
    await writeAtomic(join(dir, 'xyz.json'), '3');
    await removeWithPrefix(dir, 'abc.');
    expect(await readdir(dir)).toEqual(['xyz.json']);
    await removeWithPrefix(join(dir, 'missing'), 'a');
    expect(await readFile(join(dir, 'xyz.json'), 'utf8')).toBe('3');
  });
});
