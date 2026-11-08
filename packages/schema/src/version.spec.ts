import { describe, expect, it } from 'vitest';
import { CONTRACT_VERSION } from './version.js';

describe('CONTRACT_VERSION', () => {
  it('is version 1 of the contracts', () => {
    expect(CONTRACT_VERSION).toBe(1);
  });
});
