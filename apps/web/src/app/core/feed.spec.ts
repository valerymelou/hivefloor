import { describe, expect, it } from 'vitest';
import { robot, ROOMS } from '../../test/fixtures';
import { describeChange, FEED_SIZE, pushFeed, type FeedEntry } from './feed';

describe('feed', () => {
  it('describes arrivals, departures and activity changes as text', () => {
    expect(describeChange({ after: robot() }, ROOMS, 5, 1)).toEqual({
      id: 1,
      at: 5,
      who: 'Claude',
      where: 'Ledgerly',
      what: 'arrived',
    });
    expect(describeChange({ before: robot() }, ROOMS, 5, 2)?.what).toBe('left');
    expect(
      describeChange({ before: robot(), after: robot({ cat: 'testing' }) }, ROOMS, 5, 3)?.what,
    ).toBe('started running tests');
    expect(
      describeChange(
        { before: robot(), after: robot({ status: 'idle', cat: undefined }) },
        ROOMS,
        5,
        4,
      )?.what,
    ).toBe('is on a coffee break');
  });

  it('skips changes visitors would not notice', () => {
    expect(
      describeChange({ before: robot(), after: robot({ goal: 'New goal' }) }, ROOMS, 5, 1),
    ).toBeUndefined();
    expect(describeChange({}, ROOMS, 5, 1)).toBeUndefined();
  });

  it('keeps the newest entries first, up to the limit', () => {
    const entry = (id: number): FeedEntry => ({
      id,
      at: id,
      who: 'Claude',
      where: 'Ledgerly',
      what: 'arrived',
    });
    const feed = pushFeed([], [entry(1), entry(2)]);
    expect(feed.map((e) => e.id)).toEqual([2, 1]);
    const full = pushFeed(
      feed,
      Array.from({ length: 30 }, (_, i) => entry(i + 3)),
    );
    expect(full).toHaveLength(FEED_SIZE);
    expect(full[0]?.id).toBe(32);
  });
});
