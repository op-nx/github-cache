import { describe, expect, it } from 'vitest';
import { getCache, putCache } from './index.js';

describe('@op-nx/github-cache stub', () => {
  it('putCache throws not implemented', () => {
    expect(() =>
      putCache({ hash: 'abc', contentLength: 0, body: Buffer.alloc(0), trustTier: 'read-only' }),
    ).toThrow('Not implemented');
  });

  it('getCache throws not implemented', () => {
    expect(() => getCache({ hash: 'abc' })).toThrow('Not implemented');
  });
});
