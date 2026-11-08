import * as z from 'zod';
import { MachineConfigSchema } from './machine-config.js';
import { OfficeConfigSchema } from './office-config.js';

/**
 * Builds the JSON Schema of a config file for editor autocomplete. It describes
 * the file as written by hand (`io: "input"`), so fields with defaults are
 * optional. Rules that only Zod can check, such as unique project names, are
 * still enforced when the file is loaded.
 *
 * @param which - `office` for `office.config.json`, `machine` for the machine config.
 * @returns The JSON Schema (draft 2020-12) as a plain object.
 */
export function configJsonSchema(which: 'office' | 'machine'): Record<string, unknown> {
  const schema = which === 'office' ? OfficeConfigSchema : MachineConfigSchema;
  const title = which === 'office' ? 'Hivefloor office config' : 'Hivefloor machine config';
  return {
    ...z.toJSONSchema(schema, { io: 'input', target: 'draft-2020-12', unrepresentable: 'any' }),
    title,
  };
}
