import { constants } from 'node:fs';
import { copyFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isRecord } from '../core/payload.js';
import type { Settings } from '../core/settings.js';
import { writeAtomic } from './files.js';

/**
 * The user-level Claude Code settings file: `$CLAUDE_CONFIG_DIR/settings.json`,
 * or `~/.claude/settings.json`.
 *
 * @param env - Environment variables.
 * @param home - The owner's home folder.
 * @returns The path.
 */
export function claudeSettingsPath(
  env: { readonly CLAUDE_CONFIG_DIR?: string | undefined },
  home: string,
): string {
  return join(env.CLAUDE_CONFIG_DIR ?? join(home, '.claude'), 'settings.json');
}

/** A settings file as read from disk. */
export type SettingsFile =
  | { readonly kind: 'missing'; readonly settings: Settings }
  | { readonly kind: 'ok'; readonly settings: Settings }
  | { readonly kind: 'invalid'; readonly reason: string };

/**
 * Reads Claude Code's settings. A file that isn't a JSON object is reported, not
 * overwritten: Hivefloor never risks someone's settings.
 *
 * @param path - The settings file.
 * @returns The settings, or why they can't be used.
 */
export async function readSettings(path: string): Promise<SettingsFile> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return { kind: 'missing', settings: {} };
  }
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value)
      ? { kind: 'ok', settings: value }
      : { kind: 'invalid', reason: 'it is not a JSON object' };
  } catch {
    return { kind: 'invalid', reason: 'it is not valid JSON' };
  }
}

/**
 * Writes Claude Code's settings after copying the current file to
 * `settings.json.hivefloor-backup-<time>` (C1).
 *
 * @param path - The settings file.
 * @param settings - The new settings.
 * @param existed - Whether the file existed (no backup otherwise).
 * @param now - Unix milliseconds, for the backup name.
 * @returns The backup's path, if one was made.
 */
export async function writeSettings(
  path: string,
  settings: Settings,
  existed: boolean,
  now: number,
): Promise<string | undefined> {
  let backup: string | undefined;
  if (existed) {
    const base = `${path}.hivefloor-backup-${new Date(now).toISOString().replace(/[:.]/g, '-')}`;
    // Never overwrite an earlier backup, even one made in the same millisecond.
    for (let attempt = 0; backup === undefined; attempt++) {
      const candidate = attempt === 0 ? base : `${base}-${String(attempt)}`;
      try {
        await copyFile(path, candidate, constants.COPYFILE_EXCL);
        backup = candidate;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || attempt >= 99) throw error;
      }
    }
  }
  await writeAtomic(path, `${JSON.stringify(settings, null, 2)}\n`, 0o644);
  return backup;
}
