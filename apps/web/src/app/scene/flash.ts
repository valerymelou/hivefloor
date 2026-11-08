/** How long a robot's new activity shows as text, in seconds. */
export const FLASH_SECONDS = 3;

/** The robot showing text in each zone, and until when. */
export type Flashes = ReadonlyMap<string, { readonly key: string; readonly until: number }>;

/** No robot is showing text. */
export const NO_FLASHES: Flashes = new Map();

/**
 * Asks to show a robot's new activity as text for a moment. A zone (a room, a
 * coffee corner, the way out) shows one robot at a time, so neighbours' tags
 * don't collide; a request is dropped while another robot holds the zone.
 *
 * @param flashes - The current state.
 * @param zone - Where the robot is heading.
 * @param key - The robot's key.
 * @param now - The time in seconds.
 * @returns The new state.
 */
export function requestFlash(flashes: Flashes, zone: string, key: string, now: number): Flashes {
  const holder = flashes.get(zone);
  if (holder !== undefined && holder.until > now && holder.key !== key) return flashes;
  const live = [...flashes].filter(([, flash]) => flash.until > now);
  return new Map([...live, [zone, { key, until: now + FLASH_SECONDS }]]);
}

/**
 * Tells whether a robot is showing its activity as text.
 *
 * @param flashes - The current state.
 * @param zone - Where the robot is heading.
 * @param key - The robot's key.
 * @param now - The time in seconds.
 * @returns `true` while its moment lasts.
 */
export function isFlashing(flashes: Flashes, zone: string, key: string, now: number): boolean {
  const holder = flashes.get(zone);
  return holder?.key === key && holder.until > now;
}
