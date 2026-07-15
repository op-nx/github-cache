import { describe, expect, it } from 'vitest';
import { cacheArchivePath } from './actions-cache-backend.js';

describe('cacheArchivePath', () => {
  it('is deterministic for the same hash (required for @actions/cache version matching)', () => {
    expect(cacheArchivePath('abc123')).toBe(cacheArchivePath('abc123'));
  });

  it('differs across hashes', () => {
    expect(cacheArchivePath('abc123')).not.toBe(cacheArchivePath('def456'));
  });
});
