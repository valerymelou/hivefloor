import { describe, expect, it } from 'vitest';
import { CLI_NAME, notice } from './package-info.js';

describe('package info', () => {
  it('uses the published npm name', () => {
    expect(CLI_NAME).toBe('hivefloor');
  });

  it('points to the repository in its notice', () => {
    expect(notice()).toContain('github.com/valerymelou/hivefloor');
  });
});
