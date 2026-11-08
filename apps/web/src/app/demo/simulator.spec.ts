import { rowsNeeded, ViewerMessageSchema } from '@hivefloor/schema';
import { describe, expect, it, vi } from 'vitest';
import { DEMO_CONFIG } from '../core/config-store';
import { applyMessage, EMPTY_OFFICE } from '../core/office-view';
import { demoSessions, DemoSource, DEMO_STEP_MS } from './demo-source';
import { seededRandom, Simulator } from './simulator';

describe('demoSessions', () => {
  it('starts crowded only with #demo-crowd', () => {
    expect(demoSessions('#demo')).toBe(3);
    expect(demoSessions('#demo-crowd')).toBe(10);
  });
});

describe('Simulator (W7)', () => {
  it('only emits contract-valid messages and never seats two robots together', () => {
    const sim = new Simulator(DEMO_CONFIG, seededRandom(42));
    let view = applyMessage(EMPTY_OFFICE, ViewerMessageSchema.parse(sim.start(1000))).view;
    for (let t = 1; t <= 600; t++) {
      for (const raw of sim.step(1000 + t)) {
        const parsed = ViewerMessageSchema.safeParse(raw);
        expect(parsed.success).toBe(true);
        if (parsed.success) view = applyMessage(view, parsed.data).view;
      }
      for (const room of view.rooms) {
        const desks = view.robots
          .filter((r) => r.room === room.id && r.desk !== undefined)
          .map((r) => r.desk);
        const seats = view.robots
          .filter((r) => r.room === room.id && r.seat !== undefined)
          .map((r) => r.seat);
        expect(new Set(desks).size).toBe(desks.length);
        expect(new Set(seats).size).toBe(seats.length);
        // Every desk exists: the room grew a row for it (E5).
        expect(room.rows).toBeGreaterThanOrEqual(
          rowsNeeded(
            desks.map((d) => d ?? 0),
            DEMO_CONFIG.layout,
          ),
        );
      }
      expect(view.robots.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic for a seed', () => {
    const a = new Simulator(DEMO_CONFIG, seededRandom(1));
    const b = new Simulator(DEMO_CONFIG, seededRandom(1));
    expect(a.start(1)).toEqual(b.start(1));
    expect(a.step(2)).toEqual(b.step(2));
  });

  it('runs on a timer as a source and stops', () => {
    const timers = {
      setInterval: vi.fn((fn: () => void, _ms: number) => fn),
      clearInterval: vi.fn(),
    };
    const events = { message: vi.fn(), state: vi.fn(), reset: vi.fn() };
    const stop = new DemoSource(DEMO_CONFIG, timers).start(events);
    expect(events.state).toHaveBeenCalledWith('demo');
    expect(events.message.mock.calls[0]?.[0]).toMatchObject({ type: 'snapshot' });
    expect(timers.setInterval.mock.calls[0]?.[1]).toBe(DEMO_STEP_MS);
    const tick = timers.setInterval.mock.results[0]?.value as () => void;
    tick();
    expect(events.message.mock.calls.length).toBeGreaterThan(1);
    stop();
    expect(timers.clearInterval).toHaveBeenCalled();
  });
});
