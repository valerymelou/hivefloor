import { describe, expect, it } from 'vitest';
import { TYPING_SWING, typingSeed, typingSwing } from './typing';

const moments = Array.from({ length: 4000 }, (_, i) => i * 0.013);

describe('typingSwing', () => {
  it('never swings further than the limit', () => {
    for (const t of moments) {
      const { left, right } = typingSwing(t, 3);
      expect(Math.abs(left)).toBeLessThanOrEqual(TYPING_SWING);
      expect(Math.abs(right)).toBeLessThanOrEqual(TYPING_SWING);
    }
  });

  it('moves the two hands independently', () => {
    expect(moments.some((t) => typingSwing(t, 0).left !== typingSwing(t, 0).right)).toBe(true);
  });

  it('types in bursts, with moments when both hands rest', () => {
    const rests = moments.filter((t) => {
      const { left, right } = typingSwing(t, 0);
      return left === 0 && right === 0;
    });
    expect(rests.length).toBeGreaterThan(0);
    expect(rests.length).toBeLessThan(moments.length / 2);
  });

  it('gives the same answer for the same moment', () => {
    expect(typingSwing(1.5, 2)).toEqual(typingSwing(1.5, 2));
  });
});

describe('typingSeed', () => {
  it('is stable for a key and differs between keys', () => {
    expect(typingSeed('robot-a')).toBe(typingSeed('robot-a'));
    expect(typingSeed('robot-a')).not.toBe(typingSeed('robot-b'));
  });
});
