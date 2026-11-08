import { ViewerMessageSchema, type ViewerMessage } from '@hivefloor/schema';

/** The state of the connection to the office, shown in the header (W6). */
export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'busy' | 'closed' | 'demo';

/** What a source reports to the store. */
export interface SourceEvents {
  message(message: ViewerMessage): void;
  /** `closedUntil` is the local time of the next daily reset, for `closed`. */
  state(state: ConnectionState, closedUntil?: string): void;
}

/** Where office messages come from: the relay, or the demo simulator. */
export interface OfficeSource {
  /**
   * Starts producing messages.
   *
   * @param events - Callbacks for messages and state changes.
   * @returns A function that stops the source.
   */
  start(events: SourceEvents): () => void;
}

/**
 * Parses and validates one message from the relay. Anything that doesn't match
 * the contract is ignored.
 *
 * @param data - The raw WebSocket or HTTP payload.
 * @returns The message, or `undefined`.
 */
export function parseMessage(data: unknown): ViewerMessage | undefined {
  if (typeof data !== 'string') return undefined;
  try {
    const result = ViewerMessageSchema.safeParse(JSON.parse(data));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}
