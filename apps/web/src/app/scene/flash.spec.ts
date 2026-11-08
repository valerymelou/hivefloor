import { describe, expect, it } from 'vitest';
import { FLASH_SECONDS, isFlashing, NO_FLASHES, requestFlash } from './flash';

describe('flashes', () => {
  it('shows a robot for a moment', () => {
    const flashes = requestFlash(NO_FLASHES, 'ledgerly', 'a', 10);
    expect(isFlashing(flashes, 'ledgerly', 'a', 10)).toBe(true);
    expect(isFlashing(flashes, 'ledgerly', 'a', 10 + FLASH_SECONDS - 0.1)).toBe(true);
    expect(isFlashing(flashes, 'ledgerly', 'a', 10 + FLASH_SECONDS)).toBe(false);
  });

  it('shows one robot per zone and drops the others', () => {
    const first = requestFlash(NO_FLASHES, 'ledgerly', 'a', 10);
    const second = requestFlash(first, 'ledgerly', 'b', 11);
    expect(second).toBe(first);
    expect(isFlashing(second, 'ledgerly', 'b', 11)).toBe(false);
  });

  it('lets zones flash independently', () => {
    const flashes = requestFlash(requestFlash(NO_FLASHES, 'ledgerly', 'a', 10), 'ndop', 'b', 10);
    expect(isFlashing(flashes, 'ledgerly', 'a', 10)).toBe(true);
    expect(isFlashing(flashes, 'ndop', 'b', 10)).toBe(true);
    expect(isFlashing(flashes, 'ndop', 'a', 10)).toBe(false);
  });

  it('extends the same robot, and frees the zone afterwards', () => {
    const first = requestFlash(NO_FLASHES, 'ledgerly', 'a', 10);
    const extended = requestFlash(first, 'ledgerly', 'a', 12);
    expect(isFlashing(extended, 'ledgerly', 'a', 14)).toBe(true);
    const next = requestFlash(extended, 'ledgerly', 'b', 12 + FLASH_SECONDS);
    expect(isFlashing(next, 'ledgerly', 'b', 12 + FLASH_SECONDS)).toBe(true);
  });

  it('forgets flashes that have ended', () => {
    const old = requestFlash(NO_FLASHES, 'ledgerly', 'a', 10);
    expect(requestFlash(old, 'ndop', 'b', 100).size).toBe(1);
  });
});
