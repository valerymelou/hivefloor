import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { testIo } from './io.js';
import { makeDirs } from './sandbox.js';
import { SECRET } from './payloads.js';

/** Temporary folders plus helpers to build CommandIo and seed config files. */
export async function commandSandbox() {
  const dirs = await makeDirs();
  const io = (extra: Partial<Parameters<typeof testIo>[0]> = {}) =>
    testIo({ home: dirs.home, hivefloorHome: dirs.hivefloor, claudeDir: dirs.claude, ...extra });
  const paths = {
    config: join(dirs.hivefloor, 'config.json'),
    secret: join(dirs.hivefloor, 'secret'),
    settings: join(dirs.claude, 'settings.json'),
  };
  const seed = async (config: unknown, secret: string | null = SECRET) => {
    await mkdir(dirs.hivefloor, { recursive: true });
    await writeFile(paths.config, typeof config === 'string' ? config : JSON.stringify(config));
    if (secret !== null) await writeFile(paths.secret, secret, { mode: 0o600 });
  };
  const readJson = async (path: string) =>
    JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  return { dirs, io, paths, seed, readJson, cleanup: dirs.cleanup };
}
