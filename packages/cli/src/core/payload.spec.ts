import { describe, expect, it } from 'vitest';
import { MAX_PAYLOAD_LENGTH, parsePayload, readArray, readRecord, readString } from './payload.js';

describe('payload readers', () => {
  it('parses JSON objects only', () => {
    expect(parsePayload('{"a":1}')).toEqual({ a: 1 });
    expect(parsePayload('')).toBeUndefined();
    expect(parsePayload('not json')).toBeUndefined();
    expect(parsePayload('[1,2]')).toBeUndefined();
    expect(parsePayload('null')).toBeUndefined();
    expect(parsePayload(' '.repeat(MAX_PAYLOAD_LENGTH + 1))).toBeUndefined();
  });

  it('reads typed fields without trusting the payload', () => {
    const payload = { s: 'x', empty: '', n: 1, o: { k: 'v' }, a: [1], arr: 'no' };
    expect(readString(payload, 's')).toBe('x');
    expect(readString(payload, 'empty')).toBeUndefined();
    expect(readString(payload, 'n')).toBeUndefined();
    expect(readString(undefined, 's')).toBeUndefined();
    expect(readRecord(payload, 'o')).toEqual({ k: 'v' });
    expect(readRecord(payload, 'a')).toBeUndefined();
    expect(readArray(payload, 'a')).toEqual([1]);
    expect(readArray(payload, 'arr')).toEqual([]);
  });
});
