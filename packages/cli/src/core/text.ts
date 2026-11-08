/**
 * Removes the given characters from both ends of a string, in linear time
 * (no regular expression, so no backtracking on long runs).
 *
 * @param text - The text to trim.
 * @param chars - The characters to remove, such as `"'` or `/`.
 * @param ends - Which ends to trim.
 * @returns The trimmed text.
 */
export function trimChars(text: string, chars: string, ends: 'both' | 'end' = 'both'): string {
  let start = 0;
  let end = text.length;
  if (ends === 'both') {
    while (start < end && chars.includes(text.charAt(start))) start++;
  }
  while (end > start && chars.includes(text.charAt(end - 1))) end--;
  return text.slice(start, end);
}
