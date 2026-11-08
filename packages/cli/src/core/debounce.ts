import type { Category, EventKind } from '@hivefloor/schema';

/** What was last sent for a robot. */
export interface LastSent {
  readonly kind: EventKind;
  readonly cat?: Category;
  readonly goal?: string;
  /** Unix seconds when it was sent. */
  readonly at: number;
}

/** What the next event for a robot would report. */
export interface NextReport {
  readonly kind: EventKind;
  readonly cat?: Category;
  readonly goal?: string;
}

/** A repeat of the same report within this many seconds is skipped (C8). */
export const DEBOUNCE_SEC = 10;

const ALWAYS_SENT: ReadonlySet<EventKind> = new Set<EventKind>([
  'start',
  'end',
  'spawn',
  'done',
  'idle',
]);

/**
 * Decides whether to send an event (C8). Lifecycle events always go out. A
 * report that changes the kind, category or goal goes out at once; a repeat of
 * the same report is skipped for {@link DEBOUNCE_SEC} seconds. Any hook after
 * that sends again, which keeps an active robot's heartbeat well under 60 s.
 *
 * @param last - What was last sent for this robot, if anything.
 * @param next - What the new event would report.
 * @param now - Unix seconds.
 * @returns `true` to send.
 */
export function shouldSend(last: LastSent | undefined, next: NextReport, now: number): boolean {
  if (last === undefined || ALWAYS_SENT.has(next.kind)) {
    return true;
  }
  if (last.kind !== next.kind || last.cat !== next.cat || last.goal !== next.goal) {
    return true;
  }
  return now - last.at >= DEBOUNCE_SEC;
}
