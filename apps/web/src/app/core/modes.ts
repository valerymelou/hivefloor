/** What the page's URL hash asks for. */
export interface PageMode {
  /** Run the built-in simulator instead of connecting to the relay (W7). */
  readonly demo: boolean;
  /** Start the simulator with ten sessions. */
  readonly crowd: boolean;
  /** Show only the 3D office and a small live badge, for embedding. */
  readonly embed: boolean;
}

/**
 * Reads the page mode from the URL hash. Flags combine with `&`, for example
 * `#demo&embed`.
 *
 * @param hash - `location.hash`.
 * @returns The mode.
 */
export function pageMode(hash: string): PageMode {
  const flags = new Set(hash.replace(/^#/, '').split('&'));
  const crowd = flags.has('demo-crowd');
  return { demo: crowd || flags.has('demo'), crowd, embed: flags.has('embed') };
}
