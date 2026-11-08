import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { MachineConfig } from '@hivefloor/schema';
import { isRecord } from '../core/payload.js';
import { readJson, writeAtomic } from './files.js';
import type { HivefloorFiles } from './home.js';

/**
 * Loads the machine config. Validating with Zod costs about 20 ms, too much for
 * every hook call, so the validated config is cached by the SHA-256 of the file's
 * text, and the validator is only loaded when the file changes.
 *
 * @param files - The CLI's files.
 * @returns The config, or `undefined` when it is missing or invalid.
 */
export async function loadConfig(files: HivefloorFiles): Promise<MachineConfig | undefined> {
  let text: string;
  try {
    text = await readFile(files.config, 'utf8');
  } catch {
    return undefined;
  }
  const digest = createHash('sha256').update(text).digest('hex');
  const cached = await readJson(files.configCache);
  if (isRecord(cached) && cached['digest'] === digest && isRecord(cached['config'])) {
    // Written by us below after validation, for this exact file content.
    return cached['config'] as MachineConfig;
  }
  const { validateMachineConfig } = await import('./validate-config.js');
  const config = validateMachineConfig(text);
  if (config !== undefined) {
    await writeAtomic(files.configCache, JSON.stringify({ digest, config }));
  }
  return config;
}

/**
 * Reads the shared secret from its own file (never from the JSON config).
 *
 * @param files - The CLI's files.
 * @returns The secret, or `undefined` when it is missing or empty.
 */
export async function loadSecret(files: HivefloorFiles): Promise<string | undefined> {
  try {
    const secret = (await readFile(files.secret, 'utf8')).trim();
    return secret.length > 0 ? secret : undefined;
  } catch {
    return undefined;
  }
}
