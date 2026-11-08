import { OfficeConfigSchema, type OfficeConfig } from '@hivefloor/schema';

let cached: { readonly raw: string; readonly config: OfficeConfig | undefined } | undefined;

/**
 * Parses the `OFFICE_CONFIG` variable, once per isolate.
 *
 * @param raw - The variable's value.
 * @returns The validated config, or `undefined` when it is missing or invalid.
 */
export function officeConfig(raw: string | undefined): OfficeConfig | undefined {
  if (raw === undefined) return undefined;
  if (cached?.raw !== raw) {
    let config: OfficeConfig | undefined;
    try {
      const result = OfficeConfigSchema.safeParse(JSON.parse(raw));
      config = result.success ? result.data : undefined;
    } catch {
      config = undefined;
    }
    cached = { raw, config };
  }
  return cached.config;
}

/**
 * The office config as served by `GET /api/config` (R6). The whole file is
 * public by design (ADR 0006); only the editor's `$schema` hint is dropped.
 *
 * @param config - The validated office config.
 * @returns The public config.
 */
export function publicConfig(config: OfficeConfig): Omit<OfficeConfig, '$schema'> {
  const { $schema: _schema, ...rest } = config;
  return rest;
}
