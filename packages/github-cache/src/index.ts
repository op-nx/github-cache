// Public barrel for @op-nx/github-cache (minimal for Phase 1; Phase 6 owns the
// enumerated, tested public surface). Exposes the Nx-contract server factory and
// the CacheBackend port types so consumers can supply their own backend adapter.
export { createCacheServer } from './server/server.js';
export type {
  CacheBackend,
  GetHit,
  GetResult,
  PutResult,
  ReadableBackend,
  WritableBackend,
} from './backend/types.js';
