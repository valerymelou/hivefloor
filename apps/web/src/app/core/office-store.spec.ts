import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { msg, SNAPSHOT } from '../../test/fixtures';
import { OfficeStore } from './office-store';
import type { OfficeSource } from './source';

describe('OfficeStore', () => {
  const store = (): OfficeStore => TestBed.inject(OfficeStore);

  it('builds the view, counts and feed from messages', () => {
    const s = store();
    s.apply(msg(SNAPSHOT), 100);
    s.apply(
      msg({
        type: 'delta',
        v: 1,
        robot: {
          key: 'b00000',
          role: 'claude',
          room: 'private',
          desk: 0,
          status: 'thinking',
          since: 101,
        },
      }),
      101,
    );
    s.apply(
      msg({
        type: 'delta',
        v: 1,
        robot: {
          key: 'a9f3c2:4be1d0',
          parent: 'a9f3c2',
          role: 'Explore',
          room: 'ledgerly',
          seat: 0,
          status: 'idle',
          since: 102,
        },
      }),
      102,
    );
    s.apply(msg({ type: 'today', v: 1, count: { room: 'private', cat: 'vcs', n: 9 } }), 103);
    expect(s.robots().map((r) => r.key)).toEqual(['a9f3c2', 'b00000', 'a9f3c2:4be1d0']);
    expect(s.activeCount()).toBe(2);
    expect(s.publicWork().map((r) => r.goal)).toEqual(['Building the paywall screen']);
    expect(s.today()[0]).toEqual({ room: 'private', cat: 'vcs', n: 9 });
    expect(s.feed().map((e) => e.who)).toEqual(['Explore', 'Claude']);
  });

  it('marks the connection busy on a busy status', () => {
    const s = store();
    s.apply(msg({ type: 'status', v: 1, state: 'busy' }), 1);
    expect(s.connection()).toBe('busy');
    s.apply(msg({ type: 'status', v: 1, state: 'open' }), 2);
    expect(s.connection()).toBe('busy');
  });

  it('follows a source', () => {
    const s = store();
    let stopped = false;
    const source: OfficeSource = {
      start(events) {
        events.state('closed', '01:00');
        events.message(msg(SNAPSHOT));
        return () => {
          stopped = true;
        };
      },
    };
    const stop = s.connect(source, () => 5);
    expect(s.connection()).toBe('closed');
    expect(s.closedUntil()).toBe('01:00');
    expect(s.view().robots).toHaveLength(1);
    stop();
    expect(stopped).toBe(true);
  });
});
