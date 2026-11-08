import { isRecord } from './payload.js';
import { mcpServer } from './categories.js';

// String fields whose values are short enums, safe to keep in a recorded fixture.
const KEPT_STRING_FIELDS: ReadonlySet<string> = new Set([
  'hook_event_name',
  'source',
  'reason',
  'permission_mode',
  'status',
  'level',
]);

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const MAX_DEPTH = 6;
const MAX_ITEMS = 20;

function scrubToolName(name: string): string {
  return mcpServer(name) === undefined ? name : 'mcp__<server>__<tool>';
}

function scrubString(value: string, key: string | undefined): string {
  if (key === 'tool_name') return scrubToolName(value);
  if (key !== undefined && KEPT_STRING_FIELDS.has(key) && IDENTIFIER.test(value)) return value;
  return `<string:${String(value.length)}>`;
}

/**
 * Scrubs a hook payload for `hivefloor hook --record`, so real payload shapes
 * can become test fixtures without private data. Keeps the structure, field
 * names that look like identifiers, numbers, booleans and a few enum fields;
 * replaces every other string with `<string:LENGTH>` and MCP names with
 * placeholders.
 *
 * @param value - The payload or a part of it.
 * @param key - The field name `value` was found under.
 * @param depth - Nesting depth, used to stop at {@link MAX_DEPTH}.
 * @returns The scrubbed copy.
 */
export function scrubPayload(value: unknown, key?: string, depth = 0): unknown {
  if (typeof value === 'string') return scrubString(value, key);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (depth >= MAX_DEPTH) return '<nested>';
  if (Array.isArray(value))
    return value.slice(0, MAX_ITEMS).map((item: unknown) => scrubPayload(item, key, depth + 1));
  if (!isRecord(value)) return null;
  const out: Record<string, unknown> = {};
  let index = 0;
  for (const [field, item] of Object.entries(value)) {
    const name = IDENTIFIER.test(field) ? field : `<key:${String(index)}>`;
    out[name] = scrubPayload(item, field, depth + 1);
    index++;
  }
  return out;
}
