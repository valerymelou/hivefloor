import { describe, expect, it } from 'vitest';
import * as main from '../src/index.js';

describe('main module', () => {
  it('exports only the fetch handler and the Durable Object class', () => {
    // workerd refuses to start a Worker whose main module exports anything else.
    expect(Object.keys(main).sort()).toEqual(['Office', 'default']);
  });
});
