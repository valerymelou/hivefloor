import { readFile } from 'node:fs/promises';
import type { MachineConfig } from '@hivefloor/schema';
import { isRecord } from '../core/payload.js';
import { writeAtomic } from './files.js';
import type { Checked } from './validate-config.js';
import type { HivefloorFiles } from './home.js';

/** The `$schema` written into the machine config, for editor autocomplete. */
export const MACHINE_SCHEMA_URL = 'https://unpkg.com/hivefloor/machine.schema.json';

/** The machine config as written by hand: only the fields present in the file. */
export type RawConfig = Readonly<Record<string, unknown>>;

/**
 * Reads the machine config file as plain JSON, without applying defaults, so
 * commands can change one field and keep the file as the owner wrote it.
 *
 * @param files - The CLI's files.
 * @returns The object, `undefined` when missing, or `null` when not a JSON object.
 */
export async function readRawConfig(files: HivefloorFiles): Promise<RawConfig | undefined | null> {
  let text: string;
  try {
    text = await readFile(files.config, 'utf8');
  } catch {
    return undefined;
  }
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Validates and writes the machine config, mode 600.
 *
 * @param files - The CLI's files.
 * @param raw - The config as it should appear in the file.
 * @returns The validated config, or the validation problems.
 */
export async function writeRawConfig(
  files: HivefloorFiles,
  raw: RawConfig,
): Promise<Checked<MachineConfig>> {
  const text = `${JSON.stringify(raw, null, 2)}\n`;
  const { checkMachineConfig } = await import('./validate-config.js');
  const result = checkMachineConfig(text);
  if (!result.ok) return result;
  await writeAtomic(files.config, text);
  return result;
}
