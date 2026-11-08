/**
 * The name the CLI is published and invoked under (`npx hivefloor`).
 */
export const CLI_NAME = 'hivefloor';

/**
 * Builds the placeholder message printed while the CLI has no commands yet.
 *
 * @returns A one-line notice pointing to the project.
 *
 * @example
 * ```ts
 * notice(); // "hivefloor: no commands yet, see https://github.com/valerymelou/hivefloor"
 * ```
 */
export function notice(): string {
  return `${CLI_NAME}: no commands yet, see https://github.com/valerymelou/hivefloor`;
}
