import { describe, expect, it } from 'vitest';
import {
  busyPollDelay,
  isDailyLimit,
  MAX_RECONNECT_MS,
  nextResetLabel,
  reconnectDelay,
} from './timing';

describe('timing', () => {
  it('backs off exponentially with jitter, capped at 30 s (W6)', () => {
    expect(reconnectDelay(0, 1)).toBe(1000);
    expect(reconnectDelay(0, 0)).toBe(500);
    expect(reconnectDelay(3, 1)).toBe(8000);
    expect(reconnectDelay(50, 1)).toBe(MAX_RECONNECT_MS);
  });

  it('polls a busy office every 2 to 5 minutes (H12)', () => {
    expect(busyPollDelay(0)).toBe(120_000);
    expect(busyPollDelay(1)).toBe(300_000);
  });

  it('recognises the daily limit (H11)', () => {
    expect(isDailyLimit(429, '')).toBe(true);
    expect(isDailyLimit(503, 'Error 1027: This worker has exceeded its daily limit')).toBe(true);
    expect(isDailyLimit(503, 'Service unavailable')).toBe(false);
    expect(isDailyLimit(500, 'request 10270')).toBe(false);
  });

  it('shows the next UTC midnight in the owner time zone', () => {
    const now = Date.UTC(2026, 10, 8, 15, 0);
    expect(nextResetLabel(now, 'Africa/Douala')).toBe('01:00');
    expect(nextResetLabel(now, 'UTC')).toBe('00:00');
    expect(nextResetLabel(now, 'America/New_York')).toBe('19:00');
  });
});
