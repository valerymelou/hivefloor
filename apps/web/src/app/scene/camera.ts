import { DIMENSIONS, type Plan, type Point } from './plan';

/** Camera limits (W8): how far it may tilt, from straight down, in radians. */
export const POLAR_LIMITS = { min: 0.45, max: 1.2 } as const;

/** The camera's vertical field of view, in degrees. */
export const FIELD_OF_VIEW = 32;

/** How the camera frames the building. */
export interface Framing {
  /** The point the camera orbits. */
  readonly target: Point;
  /** The default distance from the target. */
  readonly distance: number;
  readonly minDistance: number;
  readonly maxDistance: number;
}

/** Viewports narrower than this get the phone framing (W12). */
export const NARROW_WIDTH = 760;

/**
 * Frames the whole building: every floor and both sides of the corridor (E4).
 * Phones get a wider default view (W12).
 *
 * @param plan - The building.
 * @param narrow - Whether the viewport is phone-sized.
 * @param aspect - The viewport's width divided by its height.
 * @returns The camera target and distances.
 */
export function frame(plan: Plan, narrow: boolean, aspect: number): Framing {
  const height = (plan.floors - 1) * DIMENSIONS.floorHeight;
  const depth = plan.backDepth + plan.frontDepth + DIMENSIONS.corridorWidth;
  const halfTall = Math.tan((FIELD_OF_VIEW * Math.PI) / 360);
  // Seen from a three-quarter angle, the footprint's diagonal sets the width.
  const fitWidth = Math.hypot(plan.length, depth) / 2 / (halfTall * aspect);
  const fitHeight = (depth * 0.7 + height) / 2 / halfTall;
  const distance = Math.min(
    200,
    Math.max(22, Math.max(fitWidth, fitHeight) * (narrow ? 1.15 : 1.05)),
  );
  return {
    target: { x: plan.length / 2, y: height / 2 + 0.4, z: (plan.frontDepth - plan.backDepth) / 2 },
    distance,
    minDistance: 8,
    maxDistance: Math.max(48, distance * 1.6),
  };
}

/**
 * The camera's default position relative to its target: high and to the front
 * right, as in the prototype; steeper on phones.
 *
 * @param distance - Distance from the target.
 * @param narrow - Whether the viewport is phone-sized.
 * @returns The offset from the target.
 */
export function defaultOffset(distance: number, narrow: boolean): Point {
  const direction = narrow ? { x: 22, y: 26, z: 30 } : { x: 18.5, y: 20.5, z: 25 };
  const length = Math.hypot(direction.x, direction.y, direction.z);
  return {
    x: (direction.x / length) * distance,
    y: (direction.y / length) * distance,
    z: (direction.z / length) * distance,
  };
}

/**
 * Rotates a camera offset around the target, keeping its distance and the tilt
 * limits.
 *
 * @param offset - The camera position minus the target.
 * @param azimuth - Turn about the vertical axis, in radians.
 * @param polar - Change of tilt, in radians (positive tilts towards the horizon).
 * @returns The new offset.
 */
export function orbit(offset: Point, azimuth: number, polar: number): Point {
  const radius = Math.hypot(offset.x, offset.y, offset.z);
  if (radius === 0) return offset;
  const theta = Math.atan2(offset.x, offset.z) + azimuth;
  const phi = Math.min(
    POLAR_LIMITS.max,
    Math.max(POLAR_LIMITS.min, Math.acos(Math.min(1, Math.max(-1, offset.y / radius))) + polar),
  );
  return {
    x: radius * Math.sin(phi) * Math.sin(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.cos(theta),
  };
}

/** Arrow-key orbit steps in radians (W8). */
const KEY_STEPS: Readonly<Record<string, { azimuth: number; polar: number }>> = {
  ArrowLeft: { azimuth: -0.12, polar: 0 },
  ArrowRight: { azimuth: 0.12, polar: 0 },
  ArrowUp: { azimuth: 0, polar: -0.08 },
  ArrowDown: { azimuth: 0, polar: 0.08 },
};

/**
 * The orbit step for a key, if it is an arrow key.
 *
 * @param key - `KeyboardEvent.key`.
 * @returns The step, or `undefined`.
 */
export function keyOrbit(key: string): { azimuth: number; polar: number } | undefined {
  return KEY_STEPS[key];
}

/**
 * How often a robot's animation is advanced: every frame nearby, less often far
 * away (E9).
 *
 * @param distance - Distance from the camera, in metres.
 * @returns Update every n-th frame.
 */
export function animationStride(distance: number): number {
  if (distance < 35) return 1;
  if (distance < 70) return 2;
  return 4;
}

/** A robot on screen, from its feet to its tag, in CSS pixels. */
export interface PickTarget {
  readonly key: string;
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
}

function distanceToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Finds the robot under a click or tap (W9). Small and far robots are easy to
 * miss, so anything within `radius` pixels of a robot counts; the closest wins.
 *
 * @param targets - Robots on screen.
 * @param point - The click, in CSS pixels.
 * @param radius - The tolerance.
 * @returns The robot's key, or `undefined`.
 */
export function pick(
  targets: readonly PickTarget[],
  point: { readonly x: number; readonly y: number },
  radius = 24,
): string | undefined {
  let best: { key: string; distance: number } | undefined;
  for (const target of targets) {
    const distance = distanceToSegment(point, target.from, target.to);
    if (distance <= radius && (best === undefined || distance < best.distance)) {
      best = { key: target.key, distance };
    }
  }
  return best?.key;
}
