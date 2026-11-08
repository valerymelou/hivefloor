/**
 * Safe readers for Claude Code hook payloads. A payload is untrusted input: these
 * helpers read one field at a time and never copy, spread or forward the payload.
 */

/** A parsed hook payload: a JSON object whose fields are not trusted. */
export type Payload = Readonly<Record<string, unknown>>;

/** Payloads larger than this are ignored (a Write of a huge file, for example). */
export const MAX_PAYLOAD_LENGTH = 8 * 1024 * 1024;

/**
 * Tells whether a value is a plain JSON object.
 *
 * @param value - Any value.
 * @returns `true` for non-null, non-array objects.
 */
export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parses the text Claude Code writes to the hook's stdin.
 *
 * @param text - The raw stdin contents.
 * @returns The payload, or `undefined` when it is too large, not JSON or not an object.
 */
export function parsePayload(text: string): Payload | undefined {
  if (text.length === 0 || text.length > MAX_PAYLOAD_LENGTH) {
    return undefined;
  }
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reads a non-empty string field.
 *
 * @param source - The payload or a nested object of it.
 * @param key - The field name.
 * @returns The string, or `undefined` when the field is missing, empty or not a string.
 */
export function readString(source: Payload | undefined, key: string): string | undefined {
  const value = source?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Reads a nested object field, such as `tool_input`.
 *
 * @param source - The payload or a nested object of it.
 * @param key - The field name.
 * @returns The object, or `undefined` when the field is missing or not an object.
 */
export function readRecord(source: Payload | undefined, key: string): Payload | undefined {
  const value = source?.[key];
  return isRecord(value) ? value : undefined;
}

/**
 * Reads an array field.
 *
 * @param source - The payload or a nested object of it.
 * @param key - The field name.
 * @returns The array, or an empty array when the field is missing or not an array.
 */
export function readArray(source: Payload | undefined, key: string): readonly unknown[] {
  const value = source?.[key];
  return Array.isArray(value) ? value : [];
}
