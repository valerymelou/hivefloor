/** The longest wait between reconnection attempts (docs/PRD.md, "Reliability"). */
export const MAX_RECONNECT_MS = 30_000;

/**
 * How long to wait before reconnection attempt `attempt` (from 0): exponential
 * backoff from 1 s, capped at 30 s, with jitter so visitors never reconnect all
 * at once (W6).
 *
 * @param attempt - How many attempts failed in a row.
 * @param random - A number in [0, 1).
 * @returns Milliseconds.
 */
export function reconnectDelay(attempt: number, random: number): number {
  const base = Math.min(MAX_RECONNECT_MS, 1000 * 2 ** Math.min(attempt, 10));
  return Math.round(base * (0.5 + random / 2));
}

/**
 * How long a visitor beyond the viewer cap waits before polling the snapshot
 * again: 2 to 5 minutes, with jitter (R7, H12).
 *
 * @param random - A number in [0, 1).
 * @returns Milliseconds.
 */
export function busyPollDelay(random: number): number {
  return Math.round(120_000 + random * 180_000);
}

/**
 * Tells whether a failed response means Cloudflare's daily free-plan limit was
 * reached: a 429, or Cloudflare's error 1027 page (H11).
 *
 * @param status - The HTTP status.
 * @param body - The response text.
 * @returns `true` when the office is closed until the daily reset.
 */
export function isDailyLimit(status: number, body: string): boolean {
  return status === 429 || /\b1027\b/.test(body.slice(0, 4096));
}

/**
 * The next daily reset (00:00 UTC), as a time in the owner's time zone, such as
 * "01:00" in Africa/Douala.
 *
 * @param nowMs - Unix milliseconds.
 * @param timeZone - The office's IANA time zone.
 * @returns The local time of the reset.
 */
export function nextResetLabel(nowMs: number, timeZone: string): string {
  const next = new Date(nowMs);
  next.setUTCHours(24, 0, 0, 0);
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(next);
}
