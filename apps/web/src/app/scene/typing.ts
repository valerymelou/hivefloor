/** How far a forearm swings either way while typing, in radians. */
export const TYPING_SWING = 0.16;

/** How fast the left hand taps, in radians per second. */
const TAP_RATE = 22;

/** The right hand taps a little off the left's beat, so they never fall in step. */
const RIGHT_HAND_RATE = 1.13;
const RIGHT_HAND_PHASE = 1.7;

/** The swing of each forearm at one moment, in radians. */
export interface HandSwing {
  readonly left: number;
  readonly right: number;
}

/**
 * Tells how far each forearm is swung at a moment. Hands tap quickly, in bursts
 * with short pauses between them, the way people type.
 *
 * @param seconds - Time spent typing.
 * @param seed - Keeps robots from typing in unison, from {@link typingSeed}.
 * @returns Each forearm's swing.
 */
export function typingSwing(seconds: number, seed: number): HandSwing {
  const t = seconds + seed;
  const burst = Math.min(
    1,
    Math.max(0, 0.65 + 0.55 * Math.sin(t * 0.9) + 0.25 * Math.sin(t * 2.3)),
  );
  const amount = TYPING_SWING * burst;
  return {
    left: amount * Math.sin(t * TAP_RATE),
    right: amount * Math.sin(t * TAP_RATE * RIGHT_HAND_RATE + RIGHT_HAND_PHASE),
  };
}

/**
 * Turns a robot's key into a stable time offset.
 *
 * @param key - The robot's key.
 * @returns An offset in seconds.
 */
export function typingSeed(key: string): number {
  let sum = 0;
  for (let i = 0; i < key.length; i++) sum = (sum * 31 + key.charCodeAt(i)) % 1009;
  return sum / 7;
}
