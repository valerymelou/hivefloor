import { describe, expect, it } from 'vitest';
import { pageMode } from './modes';

describe('pageMode', () => {
  it.each([
    ['', { demo: false, crowd: false, embed: false }],
    ['#demo', { demo: true, crowd: false, embed: false }],
    ['#demo-crowd', { demo: true, crowd: true, embed: false }],
    ['#embed', { demo: false, crowd: false, embed: true }],
    ['#demo&embed', { demo: true, crowd: false, embed: true }],
    ['#something-else', { demo: false, crowd: false, embed: false }],
  ])('reads %s', (hash, expected) => {
    expect(pageMode(hash)).toEqual(expected);
  });
});
