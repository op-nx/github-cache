export type PutResult = 'stored' | 'conflict' | 'forbidden';

export interface CacheBackend {
  get(hash: string): Promise<Buffer | null>;
  put(hash: string, body: Buffer): Promise<PutResult>;
}
