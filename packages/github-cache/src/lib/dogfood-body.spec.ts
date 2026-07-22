import { describe, expect, it } from 'vitest';
import { dogfoodBody } from './dogfood-body.js';

describe('dogfoodBody (F05 shared payload leaf)', () => {
  it('returns the same bytes for the same hash', () => {
    expect(dogfoodBody('abc123').equals(dogfoodBody('abc123'))).toBe(true);
  });

  it('returns different bytes for different hashes', () => {
    expect(dogfoodBody('abc123').equals(dogfoodBody('def456'))).toBe(false);
  });

  it('returns a Buffer', () => {
    expect(Buffer.isBuffer(dogfoodBody('abc123'))).toBe(true);
  });
});
