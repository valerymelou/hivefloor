import { describe, expect, it } from 'vitest';
import { pageMode } from './modes';

describe('pageMode', () => {
  it.each([
    ['', { demo: false, crowd: false, embed: false, showcase: false }],
    ['#demo', { demo: true, crowd: false, embed: false, showcase: false }],
    ['#demo-crowd', { demo: true, crowd: true, embed: false, showcase: false }],
    ['#embed', { demo: false, crowd: false, embed: true, showcase: false }],
    ['#demo&embed', { demo: true, crowd: false, embed: true, showcase: false }],
    ['#showcase', { demo: false, crowd: false, embed: false, showcase: true }],
    ['#something-else', { demo: false, crowd: false, embed: false, showcase: false }],
  ])('reads %s', (hash, expected) => {
    expect(pageMode(hash)).toEqual(expected);
  });
});
