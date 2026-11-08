import {
  DEFAULT_LAYOUT_LIMITS as limits,
  layout,
  type Robot,
  type RobotStatus,
  type Spot,
} from '@hivefloor/schema';
import { describe, expect, it } from 'vitest';
import { ROOMS, robot } from '../../test/fixtures';
import { poseFor, restClip, tagContent, targetsFor } from './behaviour';
import { buildPlan } from './plan';

const desk: Spot = { kind: 'desk', index: 0, standing: false };
const seat: Spot = { kind: 'seat', index: 0, standing: false };
const overflow: Spot = { kind: 'desk', index: 12, standing: true };

describe('poseFor (W2)', () => {
  it.each<[RobotStatus, Spot, string]>([
    ['working', desk, 'sit'],
    ['working', overflow, 'stand'],
    ['thinking', desk, 'stand'],
    ['thinking', seat, 'sit'],
    ['thinking', { ...seat, standing: true }, 'stand'],
    ['waiting', desk, 'stand'],
    ['idle', desk, 'coffee'],
    ['away', seat, 'away'],
  ])('%s at %o is %s', (status, spot, pose) => {
    expect(poseFor({ status }, spot)).toBe(pose);
  });
});

describe('restClip', () => {
  it('sits, waves on a break or when waiting, and idles otherwise', () => {
    expect(restClip('sit', 'working')).toEqual({ clip: 'sit' });
    expect(restClip('coffee', 'idle')).toEqual({ clip: 'wave', then: 'idle' });
    expect(restClip('stand', 'waiting')).toEqual({ clip: 'wave', then: 'idle' });
    expect(restClip('stand', 'thinking')).toEqual({ clip: 'idle' });
  });
});

describe('tagContent (W4)', () => {
  const main = robot({
    key: 'aaaaa1',
    room: 'ledgerly',
    goal: 'Building the paywall',
    cat: 'testing',
  });
  const sub = robot({
    key: 'aaaaa1:bbbbb1',
    parent: 'aaaaa1',
    role: 'Explore',
    room: 'ledgerly',
    desk: undefined,
    seat: 0,
  });
  const hidden = robot({ key: 'ccccc1', room: 'private', status: 'thinking', cat: undefined });

  it('shows the work, the project and the goal while working', () => {
    expect(tagContent(main, ROOMS, 'resting', 'sit')).toEqual({
      badge: { text: 'Running tests', icon: 'testing', quiet: false, dots: false },
      name: 'Claude · Ledgerly',
      subagent: false,
      goal: 'Building the paywall',
    });
  });

  it('names private robots without the project and subagents by type', () => {
    expect(tagContent(hidden, ROOMS, 'resting', 'stand')).toEqual({
      badge: { text: 'Thinking', quiet: false, dots: true },
      name: 'Claude · Private project',
      subagent: false,
    });
    expect(tagContent(sub, ROOMS, 'resting', 'sit')).toMatchObject({
      name: 'Explore · subagent',
      subagent: true,
    });
    expect(tagContent(sub, ROOMS, 'resting', 'sit').goal).toBeUndefined();
  });

  it('says where a walking robot is heading, without the goal', () => {
    const tag = (
      r: Robot,
      motion: 'arriving' | 'walking' | 'leaving',
      pose: 'sit' | 'coffee' | 'away',
    ) => tagContent(r, ROOMS, motion, pose);
    expect(tag(main, 'arriving', 'sit').badge?.text).toBe('Arriving');
    expect(tag(main, 'walking', 'sit').badge?.text).toBe('Back to the desk');
    expect(tag(main, 'walking', 'coffee').badge).toMatchObject({
      text: 'Heading for coffee',
      icon: 'coffee',
    });
    expect(tag(main, 'leaving', 'sit').badge?.text).toBe('Leaving');
    expect(tag(sub, 'walking', 'away').badge?.text).toBe('Done, heading out');
    expect(tag(main, 'walking', 'sit').goal).toBeUndefined();
  });

  it('labels waiting, breaks and away robots', () => {
    const at = (status: RobotStatus, extra: Partial<Robot> = {}) =>
      tagContent(robot({ status, ...extra }), ROOMS, 'resting', 'stand').badge;
    expect(at('waiting')?.text).toBe('Waiting for input');
    expect(at('idle')).toMatchObject({ text: 'On a break', icon: 'coffee', quiet: true });
    expect(at('away')).toBeUndefined();
    expect(at('working', { cat: undefined })).toBeUndefined();
  });
});

describe('targetsFor', () => {
  const robots: Robot[] = [
    robot({ key: '00000a', room: 'ledgerly', desk: 0 }),
    robot({ key: '00000b', room: 'ledgerly', desk: 1, status: 'idle', cat: undefined }),
    robot({ key: '00000c', room: 'private', desk: 0, status: 'idle', cat: undefined }),
    robot({ key: '00000d', room: 'private', desk: 1, status: 'away', cat: undefined }),
    robot({
      key: '00000d:00000e',
      parent: '00000d',
      role: 'Explore',
      room: 'private',
      desk: undefined,
      seat: 7,
    }),
  ];
  const result = layout(
    ROOMS.map((r) => ({ id: r.id, slot: r.slot, rows: r.rows })),
    robots.map((r) =>
      r.seat === undefined
        ? { key: r.key, room: r.room, lastActiveAt: r.since, desk: r.desk ?? 0 }
        : { key: r.key, room: r.room, lastActiveAt: r.since, seat: r.seat },
    ),
    limits,
  );
  const plan = buildPlan(result, limits);
  const targets = targetsFor(
    [...robots, robot({ key: 'fffff0' })],
    [...result.robots, { key: 'fffff1', room: 'nowhere', spot: desk }],
    plan,
  );

  it('sends every drawn robot somewhere', () => {
    expect([...targets.keys()].sort()).toEqual([
      '00000a',
      '00000b',
      '00000c',
      '00000d',
      '00000d:00000e',
    ]);
    expect(targets.get('00000a')).toMatchObject({
      pose: 'sit',
      id: expect.stringContaining('room:ledgerly') as unknown,
    });
    expect(targets.get('00000d')).toMatchObject({ pose: 'away', destination: { kind: 'exit' } });
    expect(targets.get('00000d:00000e')).toMatchObject({ pose: 'stand' });
    expect(targets.get('00000d:00000e')?.id).toContain('standing');
  });

  it('shares out coffee places by key', () => {
    expect(targets.get('00000b')?.id).toBe('coffee:0:0');
    expect(targets.get('00000c')?.id).toBe('coffee:0:1');
  });
});
