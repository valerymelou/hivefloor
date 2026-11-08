import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ROOM_PALETTE } from './constants.js';
import {
  compareText,
  fnv1a,
  hasControlChars,
  looksLikeLink,
  NEUTRAL_COLOR,
  projectColor,
  slugify,
} from './text.js';

describe('slugify', () => {
  it.each([
    ['Ledgerly', 'ledgerly'],
    ['Ndop UI', 'ndop-ui'],
    ['Café Débats', 'cafe-debats'],
    ['  --Hello,  World!-- ', 'hello-world'],
    ['v2.0 Beta', 'v2-0-beta'],
    ['🚀', ''],
  ])('turns %j into %j', (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it('always returns lowercase letters, digits and single inner hyphens', () => {
    fc.assert(
      fc.property(fc.string(), (name) => {
        expect(slugify(name)).toMatch(/^([a-z0-9]+(-[a-z0-9]+)*)?$/);
      }),
    );
  });
});

describe('text checks', () => {
  it('finds control characters', () => {
    expect(hasControlChars('plain text')).toBe(false);
    expect(hasControlChars('line\nbreak')).toBe(true);
    expect(hasControlChars('bell\u0007')).toBe(true);
    expect(hasControlChars('c1\u0085')).toBe(true);
  });

  it.each(['see https://example.com', 'go to www.example.com', 'example.com/path', 'mailto://x'])(
    'treats %j as a link',
    (value) => {
      expect(looksLikeLink(value)).toBe(true);
    },
  );

  it.each(['Building the paywall screen', 'Fix v2.0 release notes', 'Use Node.js 22'])(
    'does not treat %j as a link',
    (value) => {
      expect(looksLikeLink(value)).toBe(false);
    },
  );
});

describe('projectColor', () => {
  it('keeps a configured colour', () => {
    expect(projectColor('Ledgerly', '#f2a65a')).toBe('#f2a65a');
  });

  it('picks a stable palette colour from the name', () => {
    const color = projectColor('Ledgerly');
    expect(ROOM_PALETTE).toContain(color);
    expect(projectColor('Ledgerly')).toBe(color);
  });

  it('falls back to the neutral colour for an empty palette', () => {
    expect(projectColor('Ledgerly', undefined, [])).toBe(NEUTRAL_COLOR);
    expect(projectColor('Ledgerly', undefined, ['#000000'])).toBe('#000000');
  });

  it('hashes with FNV-1a', () => {
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
  });
});

describe('compareText', () => {
  it('orders by code unit, not locale', () => {
    expect(['b', 'B', 'a', 'é'].sort(compareText)).toEqual(['B', 'a', 'b', 'é']);
    expect(compareText('x', 'x')).toBe(0);
  });
});
