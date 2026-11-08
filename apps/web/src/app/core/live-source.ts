import { busyPollDelay, isDailyLimit, nextResetLabel, reconnectDelay } from './timing';
import { parseMessage, type OfficeSource, type SourceEvents } from './source';

/** The browser facilities the live source uses, injected so tests can fake them. */
export interface LiveDeps {
  /** The page's base URL, so the office works under a base path such as /office/. */
  readonly baseUrl: string;
  readonly createSocket: (url: string) => WebSocket;
  readonly fetch: typeof fetch;
  readonly setTimeout: (fn: () => void, ms: number) => unknown;
  readonly clearTimeout: (handle: unknown) => void;
  readonly random: () => number;
  readonly now: () => number;
  /** The office's time zone, for "Office closed until 01:00". */
  readonly timeZone: () => string;
}

/**
 * Connects to the relay's `/live` WebSocket (R4) and keeps it connected:
 * reconnects with capped, jittered backoff, shows "Reconnecting", infers the
 * "Office closed" state from the daily-limit response (H11), and falls back to
 * polling `/api/snapshot` every 2–5 minutes when the relay says it is busy (R7).
 */
export class LiveSource implements OfficeSource {
  /**
   * @param deps - Browser facilities.
   */
  constructor(private readonly deps: LiveDeps) {}

  /**
   * Starts the connection.
   *
   * @param events - Callbacks for messages and state changes.
   * @returns A function that closes the connection and stops retrying.
   */
  start(events: SourceEvents): () => void {
    const { deps } = this;
    let attempt = 0;
    let stopped = false;
    let busy = false;
    let timer: unknown;
    let socket: WebSocket | undefined;
    const url = (path: string): string => new URL(path, deps.baseUrl).toString();

    const later = (fn: () => void, ms: number): void => {
      if (!stopped) timer = deps.setTimeout(fn, ms);
    };

    const poll = async (): Promise<void> => {
      try {
        const response = await deps.fetch(url('api/snapshot'));
        const message = response.ok ? parseMessage(await response.text()) : undefined;
        if (message !== undefined) events.message(message);
      } catch {
        // Try again at the next poll.
      }
      later(() => void poll(), busyPollDelay(deps.random()));
    };

    const failed = async (): Promise<void> => {
      if (stopped || busy) return;
      try {
        const response = await deps.fetch(url('api/snapshot'));
        if (!response.ok && isDailyLimit(response.status, await response.text())) {
          events.state('closed', nextResetLabel(deps.now(), deps.timeZone()));
          // The office stays closed until the daily reset: check rarely (H11, H12).
          later(open, busyPollDelay(deps.random()));
          return;
        }
        events.state('reconnecting');
      } catch {
        events.state('reconnecting');
      }
      later(open, reconnectDelay(attempt++, deps.random()));
    };

    const open = (): void => {
      if (stopped) return;
      const target = new URL('live', deps.baseUrl);
      target.protocol = target.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = deps.createSocket(target.toString());
      socket.addEventListener('open', () => {
        attempt = 0;
        events.state('live');
      });
      socket.addEventListener('message', (event: MessageEvent) => {
        const message = parseMessage(event.data);
        if (message === undefined) return;
        if (message.type === 'status' && message.state === 'busy') {
          busy = true;
          events.state('busy');
          void poll();
          return;
        }
        events.message(message);
      });
      socket.addEventListener('close', () => void failed());
    };

    events.state('connecting');
    open();
    return () => {
      stopped = true;
      deps.clearTimeout(timer);
      socket?.close(1000, 'bye');
    };
  }
}
