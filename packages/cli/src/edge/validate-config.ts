import {
  MachineConfigSchema,
  OfficeConfigSchema,
  type MachineConfig,
  type OfficeConfig,
} from '@hivefloor/schema';

/** A config validation result: the config with defaults, or one line per problem. */
export type Checked<T> =
  { readonly ok: true; readonly config: T } | { readonly ok: false; readonly problems: string[] };

interface Issue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

const NOT_JSON = Symbol('not JSON');

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return NOT_JSON;
  }
}

function describe(issues: readonly Issue[]): string[] {
  return issues.map(
    (issue) =>
      `${issue.path.length === 0 ? '(file)' : issue.path.map(String).join('.')}: ${issue.message}`,
  );
}

/**
 * Validates machine config text and explains what is wrong. Kept in its own
 * module so the hook loads Zod only when the config file changes.
 *
 * @param text - The contents of `config.json`.
 * @returns The config with defaults applied, or the problems.
 */
export function checkMachineConfig(text: string): Checked<MachineConfig> {
  const value = parseJson(text);
  if (value === NOT_JSON) return { ok: false, problems: ['(file): not valid JSON'] };
  const result = MachineConfigSchema.safeParse(value);
  return result.success
    ? { ok: true, config: result.data }
    : { ok: false, problems: describe(result.error.issues) };
}

/**
 * Validates machine config text.
 *
 * @param text - The contents of `config.json`.
 * @returns The config with defaults applied, or `undefined` when it is invalid.
 */
export function validateMachineConfig(text: string): MachineConfig | undefined {
  const result = checkMachineConfig(text);
  return result.ok ? result.config : undefined;
}

/**
 * Validates `office.config.json` text and explains what is wrong (H16).
 *
 * @param text - The file's contents.
 * @returns The config with defaults applied, or the problems.
 */
export function checkOfficeConfig(text: string): Checked<OfficeConfig> {
  const value = parseJson(text);
  if (value === NOT_JSON) return { ok: false, problems: ['(file): not valid JSON'] };
  const result = OfficeConfigSchema.safeParse(value);
  return result.success
    ? { ok: true, config: result.data }
    : { ok: false, problems: describe(result.error.issues) };
}
