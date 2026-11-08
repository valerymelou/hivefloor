import { DEFAULT_LAYOUT_LIMITS as limits, layout } from '@hivefloor/schema';
import { describe, expect, it } from 'vitest';
import {
  animationStride,
  defaultOffset,
  frame,
  keyOrbit,
  orbit,
  pick,
  POLAR_LIMITS,
} from './camera';
import { buildPlan } from './plan';

const planOf = (n: number) =>
  buildPlan(
    layout(
      Array.from({ length: n }, (_, i) => ({ id: `r${String(i)}`, slot: i, rows: 1 })),
      [],
      limits,
    ),
    limits,
  );

describe('frame (W8, W12, E4)', () => {
  it('centres on the building and eases out as it grows', () => {
    const small = frame(planOf(2), false, 1.6);
    const big = frame(planOf(9), false, 1.6);
    expect(small.target.x).toBe(planOf(2).length / 2);
    expect(big.distance).toBeGreaterThan(small.distance);
    expect(big.target.y).toBeGreaterThan(small.target.y);
    expect(small.maxDistance).toBeGreaterThan(small.distance);
    expect(small.minDistance).toBeLessThan(small.distance);
  });

  it('gives phones a wider view', () => {
    const plan = planOf(4);
    expect(frame(plan, true, 1.6).distance).toBeGreaterThan(frame(plan, false, 1.6).distance);
  });

  it('steps back for a narrow canvas, so the building fits', () => {
    const plan = planOf(4);
    expect(frame(plan, false, 0.8).distance).toBeGreaterThan(frame(plan, false, 1.6).distance);
  });
});

describe('orbit', () => {
  const offset = defaultOffset(30, false);

  it('keeps the distance', () => {
    expect(Math.hypot(offset.x, offset.y, offset.z)).toBeCloseTo(30);
    const turned = orbit(offset, 0.5, 0.1);
    expect(Math.hypot(turned.x, turned.y, turned.z)).toBeCloseTo(30);
  });

  it('turns about the vertical axis', () => {
    const turned = orbit(offset, Math.PI, 0);
    expect(turned.x).toBeCloseTo(-offset.x);
    expect(turned.z).toBeCloseTo(-offset.z);
    expect(turned.y).toBeCloseTo(offset.y);
  });

  it('respects the tilt limits', () => {
    const flat = orbit(offset, 0, 5);
    const top = orbit(offset, 0, -5);
    expect(Math.acos(flat.y / 30)).toBeCloseTo(POLAR_LIMITS.max);
    expect(Math.acos(top.y / 30)).toBeCloseTo(POLAR_LIMITS.min);
    expect(orbit({ x: 0, y: 0, z: 0 }, 1, 1)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('is steeper on phones', () => {
    const phone = defaultOffset(30, true);
    expect(phone.y / 30).toBeGreaterThan(offset.y / 30);
  });
});

describe('keyOrbit', () => {
  it('orbits with the arrow keys only', () => {
    expect(keyOrbit('ArrowLeft')?.azimuth).toBeLessThan(0);
    expect(keyOrbit('ArrowRight')?.azimuth).toBeGreaterThan(0);
    expect(keyOrbit('ArrowUp')?.polar).toBeLessThan(0);
    expect(keyOrbit('ArrowDown')?.polar).toBeGreaterThan(0);
    expect(keyOrbit('a')).toBeUndefined();
  });
});

describe('animationStride (E9)', () => {
  it('updates distant robots less often', () => {
    expect(animationStride(10)).toBe(1);
    expect(animationStride(50)).toBe(2);
    expect(animationStride(100)).toBe(4);
  });
});

describe('pick (W9)', () => {
  const targets = [
    { key: 'a', from: { x: 100, y: 200 }, to: { x: 100, y: 140 } },
    { key: 'b', from: { x: 130, y: 200 }, to: { x: 130, y: 140 } },
    { key: 'c', from: { x: 300, y: 300 }, to: { x: 300, y: 300 } },
  ];

  it('picks the closest robot within the tolerance', () => {
    expect(pick(targets, { x: 102, y: 170 })).toBe('a');
    expect(pick(targets, { x: 120, y: 150 })).toBe('b');
    expect(pick(targets, { x: 100, y: 230 })).toBeUndefined();
    expect(pick(targets, { x: 310, y: 300 })).toBe('c');
    expect(pick(targets, { x: 100, y: 228 }, 30)).toBe('a');
    expect(pick([], { x: 0, y: 0 })).toBeUndefined();
  });
});
