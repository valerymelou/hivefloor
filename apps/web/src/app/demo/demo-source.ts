import { ViewerMessageSchema, type OfficeConfig } from '@hivefloor/schema';
import { pageMode } from '../core/modes';
import type { OfficeSource, SourceEvents } from '../core/source';
import { seededRandom, Simulator } from './simulator';

/** How often the demo office changes. */
export const DEMO_STEP_MS = 1500;

/**
 * How many sessions demo mode starts with: three for `#demo`, ten for
 * `#demo-crowd`, the load the frame-rate targets are set for.
 *
 * @param hash - `location.hash`.
 * @returns The number of sessions.
 */
export function demoSessions(hash: string): number {
  return pageMode(hash).crowd ? 10 : 3;
}

/**
 * Feeds the store from the {@link Simulator} instead of the relay (W7): no
 * network, same messages, validated against the same schema.
 */
export class DemoSource implements OfficeSource {
  /**
   * @param config - The office to simulate.
   * @param timers - Interval functions, injected for tests.
   * @param seed - The random seed.
   * @param sessions - How many sessions it starts with.
   */
  constructor(
    private readonly config: OfficeConfig,
    private readonly timers: {
      setInterval: (fn: () => void, ms: number) => unknown;
      clearInterval: (h: unknown) => void;
    } = {
      setInterval: (fn, ms) => setInterval(fn, ms),
      clearInterval: (h) => {
        clearInterval(h as ReturnType<typeof setInterval>);
      },
    },
    private readonly seed = 7,
    private readonly sessions = 3,
  ) {}

  /**
   * Starts the simulation.
   *
   * @param events - Callbacks for messages and state changes.
   * @returns A function that stops it.
   */
  start(events: SourceEvents): () => void {
    const simulator = new Simulator(this.config, seededRandom(this.seed));
    const now = (): number => Math.floor(Date.now() / 1000);
    const emit = (message: unknown): void => {
      const parsed = ViewerMessageSchema.safeParse(message);
      if (parsed.success) events.message(parsed.data);
    };
    events.state('demo');
    emit(simulator.start(now(), this.sessions));
    const handle = this.timers.setInterval(() => {
      for (const message of simulator.step(now())) emit(message);
    }, DEMO_STEP_MS);
    return () => {
      this.timers.clearInterval(handle);
    };
  }
}
