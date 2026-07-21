export type PutResult = 'stored' | 'conflict' | 'forbidden';

export interface GetHit {
  readonly kind: 'hit';
  readonly bytes: Buffer;
}

export type GetResult = GetHit | { readonly kind: 'miss' };

import type { Hash } from '../lib/cache-key.js';

export interface CacheBackend {
  get(hash: Hash): Promise<GetResult>;
  put(hash: Hash, bytes: Buffer): Promise<PutResult>;
}
