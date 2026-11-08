import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/** How often durations such as "for 3 minutes" refresh. */
export const CLOCK_TICK_MS = 15_000;

/**
 * The current time in Unix seconds, as a signal that ticks every 15 s, so
 * "time in status" stays fresh without re-rendering every second.
 */
@Injectable({ providedIn: 'root' })
export class Clock {
  private readonly current = signal(Math.floor(Date.now() / 1000));
  /** Unix seconds, updated every {@link CLOCK_TICK_MS}. */
  readonly now = this.current.asReadonly();

  constructor() {
    const handle = setInterval(() => {
      this.current.set(Math.floor(Date.now() / 1000));
    }, CLOCK_TICK_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(handle);
    });
  }
}
