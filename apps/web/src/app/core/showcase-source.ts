import type { ViewerMessage } from '@hivefloor/schema';
import { applyMessage, EMPTY_OFFICE, type OfficeView } from './office-view';
import { nextShowing, SHOWCASE_GRACE_MS, type Showing } from './showcase';
import type { ConnectionState, OfficeSource, SourceEvents } from './source';

/** Clock and timers, injected for tests. */
export interface ShowcaseDeps {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

function snapshotOf(view: OfficeView): ViewerMessage {
  return {
    type: 'snapshot',
    v: 1,
    at: view.at,
    rooms: [...view.rooms],
    robots: [...view.robots],
    today: [...view.today],
  };
}

/**
 * Feeds the landing page: the real office while anyone is in it, the simulator
 * while it is empty or out of reach (docs/adr/0017-landing-office.md). The relay
 * stays connected throughout, so real robots replace simulated ones the moment
 * they arrive. The two are never on screen together.
 */
export class ShowcaseSource implements OfficeSource {
  /**
   * @param live - The relay.
   * @param demo - The simulator.
   * @param deps - Clock and timers.
   */
  constructor(
    private readonly live: OfficeSource,
    private readonly demo: OfficeSource,
    private readonly deps: ShowcaseDeps,
  ) {}

  /**
   * Starts listening to the relay.
   *
   * @param events - Callbacks for messages and state changes.
   * @returns A function that stops both sources.
   */
  start(events: SourceEvents): () => void {
    const { deps, demo } = this;
    let showing: Showing = 'waiting';
    let view = EMPTY_OFFICE;
    let connection: ConnectionState = 'connecting';
    let closedUntil: string | undefined;
    let heard = false;
    let lastAgentAt = deps.now();
    let stopDemo: (() => void) | undefined;
    let timer: unknown;

    const hasAgents = (): boolean =>
      (connection === 'live' || connection === 'busy') && view.robots.length > 0;

    const show = (next: Showing): void => {
      if (next === showing) return;
      stopDemo?.();
      stopDemo = undefined;
      showing = next;
      events.reset();
      if (next === 'demo') {
        stopDemo = demo.start(events);
      } else {
        events.state(connection, closedUntil);
        events.message(snapshotOf(view));
      }
    };

    const decide = (): void => {
      deps.clearTimeout(timer);
      if (hasAgents()) lastAgentAt = deps.now();
      const quietMs = deps.now() - lastAgentAt;
      show(nextShowing(showing, { heard, hasAgents: hasAgents(), quietMs }));
      if (showing === 'live' && !hasAgents()) {
        timer = deps.setTimeout(decide, SHOWCASE_GRACE_MS - quietMs);
      }
    };

    const stopLive = this.live.start({
      message: (message) => {
        view = applyMessage(view, message).view;
        if (message.type === 'snapshot') heard = true;
        if (showing === 'live') events.message(message);
        decide();
      },
      state: (state, until) => {
        connection = state;
        closedUntil = until;
        if (state === 'reconnecting' || state === 'closed') heard = true;
        if (showing !== 'demo') events.state(state, until);
        decide();
      },
      reset: () => {
        view = EMPTY_OFFICE;
      },
    });

    return () => {
      deps.clearTimeout(timer);
      stopLive();
      stopDemo?.();
    };
  }
}
