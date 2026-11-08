import { ROOM_PALETTE } from './constants.js';

// Control characters (C0, DEL and C1) are never allowed in text that reaches the page.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

// Anything that looks like a link: a scheme, "www." or a bare domain with a path.
const LINK_LIKE = /([a-z][a-z0-9+.-]*:\/\/|www\.|\b[a-z0-9-]+\.[a-z]{2,}\/)/i;

/**
 * Tells whether a string contains control characters.
 *
 * @param value - The text to check.
 * @returns `true` when the text contains a C0 or C1 control character or DEL.
 */
export function hasControlChars(value: string): boolean {
  return CONTROL_CHARS.test(value);
}

/**
 * Tells whether a string contains something that looks like a link.
 *
 * @param value - The text to check.
 * @returns `true` for text with a URL scheme, `www.` or a `domain.tld/` path.
 *
 * @example
 * ```ts
 * looksLikeLink('see https://example.com'); // true
 * looksLikeLink('Building the paywall screen'); // false
 * ```
 */
export function looksLikeLink(value: string): boolean {
  return LINK_LIKE.test(value);
}

/**
 * Turns a project name into a room id: lowercase ASCII letters, digits and single
 * hyphens. Accents are removed; other characters become hyphens.
 *
 * @param name - A project name such as `"Ndop UI"`.
 * @returns The slug, such as `"ndop-ui"`. Empty when the name has no letters or digits.
 *
 * @example
 * ```ts
 * slugify('Ndop UI'); // "ndop-ui"
 * slugify('Café Débats'); // "cafe-debats"
 * ```
 */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * 32-bit FNV-1a hash of a string's UTF-16 code units. Small, fast and the same
 * everywhere, which is all the palette needs. Not for security.
 *
 * @param value - The text to hash.
 * @returns An unsigned 32-bit integer.
 */
export function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** The colour used when a palette is empty: the private room's grey. */
export const NEUTRAL_COLOR = '#8d94ab';

/**
 * The colour of a public project's room: its configured colour, or one picked from
 * the palette by a hash of its name, so it stays the same everywhere (E1).
 *
 * @param name - The project name.
 * @param configured - The colour from `office.config.json`, if any.
 * @param palette - Colours to pick from; {@link ROOM_PALETTE} by default.
 * @returns A `#rrggbb` colour, or {@link NEUTRAL_COLOR} for an empty palette.
 */
export function projectColor(
  name: string,
  configured?: string,
  palette: readonly string[] = ROOM_PALETTE,
): string {
  if (configured !== undefined) {
    return configured;
  }
  return palette[fnv1a(name) % palette.length] ?? NEUTRAL_COLOR;
}

/**
 * Compares two strings by UTF-16 code units, the same in every runtime and locale
 * (unlike `localeCompare`). Used wherever the layout needs a stable order.
 *
 * @param a - First string.
 * @param b - Second string.
 * @returns A negative number, zero or a positive number, as `Array.prototype.sort` expects.
 */
export function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
