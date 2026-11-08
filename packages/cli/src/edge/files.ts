import { randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Reads a JSON file.
 *
 * @param path - The file.
 * @returns The parsed value, or `undefined` when the file is missing or not JSON.
 */
export async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Writes a file atomically: to a temporary file next to it, then renamed over it,
 * so a parallel hook never reads half a file (H6).
 *
 * @param path - The file.
 * @param contents - The text to write.
 * @param mode - File mode for new files.
 */
export async function writeAtomic(path: string, contents: string, mode = 0o600): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    await writeFile(temporary, contents, { mode });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

/**
 * Deletes every file in a folder whose name starts with a prefix.
 *
 * @param dir - The folder.
 * @param prefix - The name prefix.
 */
export async function removeWithPrefix(dir: string, prefix: string): Promise<void> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return;
  }
  await Promise.all(
    names
      .filter((name) => name.startsWith(prefix))
      .map((name) => rm(join(dir, name), { force: true })),
  );
}
