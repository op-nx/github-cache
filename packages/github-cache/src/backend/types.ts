export type PutResult = 'stored' | 'conflict' | 'forbidden';

export interface GetHit {
  readonly kind: 'hit';
  readonly bytes: Buffer;
}

export type GetResult = GetHit | { readonly kind: 'miss' };

export interface CacheBackend {
  get(hash: string): Promise<GetResult>;
  put(hash: string, bytes: Buffer): Promise<PutResult>;
}
