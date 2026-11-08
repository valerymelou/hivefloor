import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signBody } from './sign.js';

describe('signBody', () => {
  it('signs timestamp.body with HMAC-SHA256', () => {
    const expected = createHmac('sha256', 's').update('1794091200.{"v":1}').digest('hex');
    expect(signBody('s', 1794091200, '{"v":1}')).toBe(expected);
  });
});
