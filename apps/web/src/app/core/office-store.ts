import { computed, Injectable, signal } from '@angular/core';
import type { Robot, ViewerMessage } from '@hivefloor/schema';
import { describeChange, pushFeed, type FeedEntry } from './feed';
import { applyMessage, EMPTY_OFFICE, type OfficeView } from './office-view';
import type { ConnectionState, OfficeSource } from './source';

const ACTIVE: ReadonlySet<Robot['status']> = new Set(['working', 'thinking']);

/**
 * The one store that owns the office state on the page: the view built from
 * relay messages, the connection state and the activity feed (W5, W6).
 */
@Injectable({ providedIn: 'root' })
export class OfficeStore {
  private nextId = 0;
  private readonly viewState = signal<OfficeView>(EMPTY_OFFICE);
  private readonly feedState = signal<readonly FeedEntry[]>([]);

  /** The office as last described by the relay. */
  readonly view = this.viewState.asReadonly();
  /** The newest feed entries, newest first. */
  readonly feed = this.feedState.asReadonly();
  /** The connection state shown in the header. */
  readonly connection = signal<ConnectionState>('connecting');
  /** For `closed`: when the office opens again, in the owner's time zone. */
  readonly closedUntil = signal<string | undefined>(undefined);

  /** Every robot, main sessions first, then by key. */
  readonly robots = computed(() =>
    [...this.view().robots].sort(
      (a, b) =>
        Number(a.parent !== undefined) - Number(b.parent !== undefined) ||
        a.key.localeCompare(b.key),
    ),
  );
  /** How many robots are working or thinking right now. */
  readonly activeCount = computed(
    () => this.view().robots.filter((r) => ACTIVE.has(r.status)).length,
  );
  /** Main sessions in public projects that have a goal: the Building in public card. */
  readonly publicWork = computed(() => this.robots().filter((r) => r.goal !== undefined));
  /** Today's counts, largest first. */
  readonly today = computed(() => [...this.view().today].sort((a, b) => b.n - a.n));

  /** The robot whose card is open (W9). */
  readonly selected = signal<string | undefined>(undefined);

  /** The selected robot, while it is still in the office. */
  readonly selectedRobot = computed(() => {
    const key = this.selected();
    return key === undefined ? undefined : this.view().robots.find((r) => r.key === key);
  });

  /**
   * Applies one message from the source.
   *
   * @param message - A validated viewer message.
   * @param nowSec - Local time in Unix seconds, for feed entries.
   */
  apply(message: ViewerMessage, nowSec: number): void {
    if (message.type === 'status') {
      if (message.state === 'busy') this.connection.set('busy');
      return;
    }
    const { view, changes } = applyMessage(this.viewState(), message);
    this.viewState.set(view);
    const entries = changes.flatMap((change) => {
      const entry = describeChange(change, view.rooms, nowSec, this.nextId++);
      return entry === undefined ? [] : [entry];
    });
    if (entries.length > 0) this.feedState.update((feed) => pushFeed(feed, entries));
  }

  /**
   * Connects the store to a source.
   *
   * @param source - The relay or the demo simulator.
   * @param now - Clock in Unix seconds.
   * @returns A function that disconnects.
   */
  connect(
    source: OfficeSource,
    now: () => number = () => Math.floor(Date.now() / 1000),
  ): () => void {
    return source.start({
      message: (message) => {
        this.apply(message, now());
      },
      state: (state, closedUntil) => {
        this.connection.set(state);
        this.closedUntil.set(closedUntil);
      },
    });
  }
}
