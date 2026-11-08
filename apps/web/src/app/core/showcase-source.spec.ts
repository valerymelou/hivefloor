import type { Robot, ViewerMessage } from '@hivefloor/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { robot } from '../../test/fixtures';
import { SHOWCASE_GRACE_MS } from './showcase';
import { ShowcaseSource } from './showcase-source';
import type { OfficeSource, SourceEvents } from './source';

const ROBOT = robot();

function snapshot(robots: readonly Robot[]): ViewerMessage {
  return { type: 'snapshot', v: 1, at: 2000, rooms: [], robots: [...robots], today: [] };
}

function fakeSource(): { source: OfficeSource; events: () => SourceEvents; stop: () => void } {
  let current: SourceEvents | undefined;
  const stop = vi.fn();
  return {
    source: {
      start: (events) => {
        current = events;
        return stop;
      },
    },
    events: () => {
      if (current === undefined) throw new Error('not started');
      return current;
    },
    stop,
  };
}

function setup() {
  const live = fakeSource();
  const demo = fakeSource();
  const demoStart = vi.spyOn(demo.source, 'start');
  let now = 0;
  const timers: { fn: () => void; ms: number }[] = [];
  const page = { message: vi.fn(), state: vi.fn(), reset: vi.fn() };
  const stop = new ShowcaseSource(live.source, demo.source, {
    now: () => now,
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
    clearTimeout: () => {
      timers.length = 0;
    },
  }).start(page);
  const advance = (ms: number): void => {
    now += ms;
    timers.shift()?.fn();
  };
  return { live, demo, demoStart, page, stop, advance, timers };
}

describe('ShowcaseSource', () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => {
    s = setup();
  });

  it('starts nothing but the relay, and reports that it is connecting', () => {
    s.live.events().state('connecting');
    expect(s.page.state).toHaveBeenCalledWith('connecting', undefined);
    expect(s.demoStart).not.toHaveBeenCalled();
  });

  it('starts the simulator when the first snapshot is empty', () => {
    s.live.events().state('live');
    s.live.events().message(snapshot([]));
    expect(s.demoStart).toHaveBeenCalledOnce();
    expect(s.page.reset).toHaveBeenCalledOnce();
    expect(s.page.message).not.toHaveBeenCalled();
  });

  it('starts the simulator when the relay cannot be reached', () => {
    s.live.events().state('reconnecting');
    expect(s.demoStart).toHaveBeenCalledOnce();
  });

  it('shows real robots straight away', () => {
    s.live.events().state('live');
    s.live.events().message(snapshot([ROBOT]));
    expect(s.demoStart).not.toHaveBeenCalled();
    expect(s.page.state).toHaveBeenLastCalledWith('live', undefined);
    expect(s.page.message).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'snapshot', robots: [ROBOT] }),
    );
  });

  it('hides relay messages while the simulator runs, then swaps to the real office', () => {
    s.live.events().state('live');
    s.live.events().message(snapshot([]));
    s.page.reset.mockClear();
    s.demo.events().state('demo');
    s.live.events().message({ type: 'delta', v: 1, robot: ROBOT });
    expect(s.demo.stop).toHaveBeenCalledOnce();
    expect(s.page.reset).toHaveBeenCalledOnce();
    expect(s.page.state).toHaveBeenLastCalledWith('live', undefined);
    expect(s.page.message).toHaveBeenCalledOnce();
    expect(s.page.message).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'snapshot', robots: [ROBOT] }),
    );
  });

  it('forwards live messages while the real office is showing', () => {
    s.live.events().state('live');
    s.live.events().message(snapshot([ROBOT]));
    s.page.message.mockClear();
    const change: ViewerMessage = { type: 'delta', v: 1, robot: { ...ROBOT, status: 'thinking' } };
    s.live.events().message(change);
    expect(s.page.message).toHaveBeenCalledWith(change);
  });

  it('waits out a short gap before going back to the simulator', () => {
    s.live.events().state('live');
    s.live.events().message(snapshot([ROBOT]));
    s.live.events().message({ type: 'leave', v: 1, key: ROBOT.key });
    expect(s.demoStart).not.toHaveBeenCalled();
    expect(s.timers[0]?.ms).toBe(SHOWCASE_GRACE_MS);
    s.advance(SHOWCASE_GRACE_MS);
    expect(s.demoStart).toHaveBeenCalledOnce();
  });

  it('keeps the real office when someone arrives during the gap', () => {
    s.live.events().state('live');
    s.live.events().message(snapshot([ROBOT]));
    s.live.events().message({ type: 'leave', v: 1, key: ROBOT.key });
    s.live.events().message({ type: 'delta', v: 1, robot: ROBOT });
    expect(s.timers).toHaveLength(0);
    expect(s.demoStart).not.toHaveBeenCalled();
  });

  it('keeps the real office through a dropped connection, and reports it', () => {
    s.live.events().state('live');
    s.live.events().message(snapshot([ROBOT]));
    s.live.events().state('reconnecting');
    expect(s.page.state).toHaveBeenLastCalledWith('reconnecting', undefined);
    expect(s.demoStart).not.toHaveBeenCalled();
  });

  it('stops both sources', () => {
    const stopLive = s.live.stop;
    s.live.events().state('reconnecting');
    s.stop();
    expect(stopLive).toHaveBeenCalledOnce();
    expect(s.demo.stop).toHaveBeenCalledOnce();
  });
});
