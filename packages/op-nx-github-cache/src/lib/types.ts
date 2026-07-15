// Nx hashes are lowercase hex (verified pv-1). Shared by server.ts (validates
// inbound request hashes before they reach a backend/temp-file/asset-name)
// and publish-mirror.ts (filters Actions-cache keys, which may belong to
// unrelated caching steps in the same repo -- e.g. actions/setup-node -- and
// are not guaranteed to be Nx-shaped or path-traversal-safe).
// Length is bounded so an over-long hash yields a uniform 400 rather than an
// ENAMETOOLONG 500 when interpolated into a temp-file path; 512 matches
// @actions/cache's own key-length ceiling and is far above any real Nx hash.
export const HASH_PATTERN = /^[a-f0-9]{1,512}$/;

export type PutResult = 'stored' | 'conflict' | 'forbidden';

export interface CacheBackend {
  get(hash: string): Promise<Buffer | null>;
  put(hash: string, body: Buffer): Promise<PutResult>;
}
