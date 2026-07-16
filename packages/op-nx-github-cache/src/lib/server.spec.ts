import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_BODY_BYTES, resolveMaxBodyBytes } from './server.js';

describe('resolveMaxBodyBytes', () => {
  it('uses the configured value when it is a finite number', () => {
    expect(resolveMaxBodyBytes('1024')).toBe(1024);
  });

  it('falls back to the default instead of failing open on a non-numeric value', () => {
    expect(resolveMaxBodyBytes('not-a-number')).toBe(DEFAULT_MAX_BODY_BYTES);
  });

  it('falls back to the default when unset', () => {
    expect(resolveMaxBodyBytes(undefined)).toBe(DEFAULT_MAX_BODY_BYTES);
  });

  it('falls back to the default on zero or negative values instead of 413-ing every PUT', () => {
    expect(resolveMaxBodyBytes('0')).toBe(DEFAULT_MAX_BODY_BYTES);
    expect(resolveMaxBodyBytes('-5')).toBe(DEFAULT_MAX_BODY_BYTES);
  });
});
