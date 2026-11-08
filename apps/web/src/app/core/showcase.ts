/** What the landing page is showing: nothing yet, the real office, or the simulator. */
export type Showing = 'waiting' | 'live' | 'demo';

/**
 * How long the real office may stay empty or unreachable before the landing page
 * switches to the simulator, so that a dropped connection or a gap between two
 * sessions doesn't swap every robot on screen.
 */
export const SHOWCASE_GRACE_MS = 30_000;

/** What the rule needs to know about the real office. */
export interface ShowcaseFacts {
  /** The relay has sent its first snapshot, or has failed to connect. */
  readonly heard: boolean;
  /** Connected, with at least one robot in the office. */
  readonly hasAgents: boolean;
  /** How long the office has had no agents, in milliseconds. */
  readonly quietMs: number;
}

/**
 * Decides what the landing page shows next. Real robots always win. Simulated
 * ones fill the office only while it is empty, and never appear beside real ones.
 *
 * @param showing - What is on screen now.
 * @param facts - The state of the real office.
 * @returns What to show.
 */
export function nextShowing(showing: Showing, facts: ShowcaseFacts): Showing {
  if (facts.hasAgents) return 'live';
  switch (showing) {
    case 'waiting':
      return facts.heard ? 'demo' : 'waiting';
    case 'live':
      return facts.quietMs >= SHOWCASE_GRACE_MS ? 'demo' : 'live';
    case 'demo':
      return 'demo';
  }
}
