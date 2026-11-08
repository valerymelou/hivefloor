import { DurableObject } from 'cloudflare:workers';
import {
  TIMESTAMP_WINDOW_SEC,
  type IngestEvent,
  type OfficeConfig,
  type SnapshotMessageInput,
  type ViewerMessageInput,
} from '@hivefloor/schema';
import { officeConfig } from './config.js';
import type { Env } from './env.js';
import type { OfficeState } from './state/model.js';
import { applyEvent, emptyOffice, nextWake, rollDay, tick, type Change } from './state/office.js';
import { load, migrate, persist, seenBefore } from './state/store.js';
import { snapshotView } from './state/view.js';

/** The tag given to visitors' WebSockets. */
const VIEWER = 'viewer';

/**
 * The Office Durable Object (R3–R7): the one place that holds the office state,
 * assigns rooms, desks and seats, runs presence and broadcasts every change to
 * visitors over hibernating WebSockets.
 */
export class Office extends DurableObject {
  private state: OfficeState;

  /**
   * Loads the state from SQLite. Runs again after hibernation, so it stays light.
   *
   * @param ctx - The Durable Object state.
   * @param env - The relay's bindings.
   */
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.state = { day: '', rooms: [], robots: [], today: [], departed: [] };
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    void ctx.blockConcurrencyWhile(() => {
      migrate(ctx.storage.sql);
      const config = this.config();
      const now = Math.floor(Date.now() / 1000);
      const stored = load(ctx.storage.sql, new Date(now * 1000).toISOString().slice(0, 10));
      this.state =
        stored.rooms.length === 0 && config !== undefined
          ? { ...emptyOffice(config, now), day: stored.day }
          : stored;
      return Promise.resolve();
    });
  }

  private config(): OfficeConfig | undefined {
    return officeConfig(this.env.OFFICE_CONFIG);
  }

  /** Persists a change, broadcasts its messages and schedules the next alarm. */
  private async commit(change: Change, config: OfficeConfig): Promise<void> {
    const before = this.state;
    this.ctx.storage.transactionSync(() => persist(this.ctx.storage.sql, before, change.state));
    this.state = change.state;
    this.broadcast(change.messages);
    const wake = nextWake(this.state, config);
    if (wake === undefined) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(wake * 1000);
  }

  private broadcast(messages: readonly ViewerMessageInput[]): void {
    if (messages.length === 0) return;
    const sockets = this.ctx.getWebSockets(VIEWER);
    for (const message of messages) {
      const text = JSON.stringify(message);
      for (const socket of sockets) {
        try {
          socket.send(text);
        } catch {
          // A closing socket; the runtime cleans it up.
        }
      }
    }
  }

  private async newDay(config: OfficeConfig, now: number): Promise<void> {
    const change = rollDay(this.state, now, config);
    if (change.state !== this.state) await this.commit(change, config);
  }

  /**
   * Applies one verified event. Called by the Worker over RPC.
   *
   * @param event - A verified event.
   * @param signature - Its signature, for replay protection (R2).
   * @param nowMs - Relay time in milliseconds.
   * @returns `replay` when the signature was seen in the last 60 s.
   */
  async ingest(event: IngestEvent, signature: string, nowMs: number): Promise<'ok' | 'replay'> {
    const config = this.config();
    if (config === undefined) return 'ok';
    const now = Math.floor(nowMs / 1000);
    if (seenBefore(this.ctx.storage.sql, signature, now, TIMESTAMP_WINDOW_SEC)) return 'replay';
    await this.newDay(config, now);
    await this.commit(applyEvent(this.state, event, now, config), config);
    return 'ok';
  }

  /**
   * The current office (R6).
   *
   * @param nowMs - Relay time in milliseconds.
   * @returns The snapshot message.
   */
  async snapshot(nowMs: number): Promise<SnapshotMessageInput> {
    const config = this.config();
    const now = Math.floor(nowMs / 1000);
    if (config !== undefined) await this.newDay(config, now);
    return snapshotView(this.state, now, config?.layout.roomsPerFloor ?? 8);
  }

  /**
   * Accepts a visitor's WebSocket (R4) and sends the snapshot. Above the viewer
   * cap the visitor gets a `busy` status and the socket closes, so the page
   * falls back to polling (R7, H12).
   *
   * @param request - The upgrade request forwarded by the Worker.
   * @returns The 101 response.
   */
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
      return new Response(null, { status: 426 });
    const config = this.config();
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    const now = Date.now();
    if (config === undefined || this.ctx.getWebSockets(VIEWER).length >= config.viewerCap) {
      server.accept();
      server.send(
        JSON.stringify({ type: 'status', v: 1, state: 'busy' } satisfies ViewerMessageInput),
      );
      server.close(1013, 'busy');
      return new Response(null, { status: 101, webSocket: client });
    }
    this.ctx.acceptWebSocket(server, [VIEWER]);
    server.send(JSON.stringify(await this.snapshot(now)));
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Visitors only read; anything they send is ignored ("ping" is answered without waking). */
  override webSocketMessage(): void {
    // Read-only office.
  }

  /**
   * Completes a closing handshake.
   *
   * @param ws - The socket.
   * @param code - The close code.
   * @param reason - The close reason.
   */
  override webSocketClose(ws: WebSocket, code: number, reason: string): void {
    try {
      ws.close(code, reason);
    } catch {
      // Already closed.
    }
  }

  /** Presence and housekeeping (R5). */
  override async alarm(): Promise<void> {
    const config = this.config();
    if (config === undefined) return;
    const now = Math.floor(Date.now() / 1000);
    await this.newDay(config, now);
    await this.commit(tick(this.state, now, config), config);
  }
}
