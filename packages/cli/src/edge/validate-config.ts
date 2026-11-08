import { MachineConfigSchema, type MachineConfig } from '@hivefloor/schema';

/**
 * Validates the machine config text with the Zod schema. Kept in its own module
 * so the bundle loads Zod only when the config file changes.
 *
 * @param text - The contents of `config.json`.
 * @returns The config with defaults applied, or `undefined` when it is invalid.
 */
export function validateMachineConfig(text: string): MachineConfig | undefined {
  try {
    const result = MachineConfigSchema.safeParse(JSON.parse(text));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}
