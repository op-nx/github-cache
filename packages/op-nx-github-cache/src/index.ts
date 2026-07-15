import type { Readable } from 'node:stream';

export type CacheTrustTier = 'protected-write' | 'pr-isolated-write' | 'read-only';

export interface PutCacheRequest {
  hash: string;
  contentLength: number;
  body: Readable | Buffer;
  // Must be derived server-side from the verified bearer/OIDC token's claims
  // (e.g. a GitHub Actions OIDC token's `ref` or `environment` claim), never
  // taken from client-supplied request input -- a client-set trustTier would
  // let an attacker simply claim 'protected-write' and defeat the mitigation.
  trustTier: CacheTrustTier;
}

export interface GetCacheRequest {
  hash: string;
}

// ponytail: CREEP (CVE-2025-36852) -- a naive single-namespace, first-writer-wins
// bucket cache lets any PR author race the trusted branch's build and poison the
// cache. Real impl must separate protected-branch writes from PR writes (isolated
// namespace or read-only), not just reject overwrites of an existing hash.
export function putCache(_request: PutCacheRequest): never {
  throw new Error('Not implemented: @op-nx/github-cache PUT /v1/cache/{hash}');
}

export function getCache(_request: GetCacheRequest): never {
  throw new Error('Not implemented: @op-nx/github-cache GET /v1/cache/{hash}');
}
