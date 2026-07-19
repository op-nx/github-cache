import * as assetNaming from '../lib/release-asset-name.js';
import type { CacheBackend, GetResult, PutResult } from './types.js';

/**
 * The D-04 injected read seam. Exactly one method on purpose: the seam sits at the
 * OS-namespaced asset NAME -- the boundary CORR-01 and TEST-05 must prove -- so a
 * test fake reduces to a Map. fetchAsset resolves the asset bytes, or undefined
 * when the asset is genuinely absent (the ordinary cold-cache path).
 *
 * It is NOT a mode flag: selectBackend always constructs the reader with the real
 * client, and no env value or caller argument can swap it (TRUST-05).
 *
 * Imported as a namespace (assetNaming) so the ONE derivation call site below is
 * the file's sole reference to releaseAssetName -- the backend composes no asset
 * name of its own; every name flows through the single-source helper (D-07, G3).
 */
export interface ReleaseReadClient {
  fetchAsset(assetName: string): Promise<Buffer | undefined>;
}

/** Once-per-process degradation flag (D-11): a cold cache must not spam every build line. */
let warned = false;

/**
 * Emit one concise degradation notice to stderr, at most once per process (D-11,
 * T-03-03, T-03-06). The sentence is fixed plain ASCII: the caught error is never
 * interpolated, no subprocess output is echoed, and no token value is reachable
 * from here -- helper stderr can carry credential-adjacent material and is
 * localized noise. Modelled on serve.ts:144's process-stream write, on stderr.
 */
function warnOnce(): void {
  if (warned) {
    return;
  }

  warned = true;
  process.stderr.write(
    'github-cache: GitHub Releases cache read failed; continuing with a cache miss.\n',
  );
}

/**
 * Read-only cross-context CacheBackend over GitHub Releases (CORR-01, D-02, D-11).
 * get resolves the running platform's asset through the single-source
 * releaseAssetName helper and returns its bytes or a MISS; put is forbidden by
 * construction. The injected client is the D-04 seam and the ONLY parameter -- this
 * factory must never grow a mode argument (TRUST-05).
 *
 * This backend never returns 'stored' and never returns 'conflict' (those belong to
 * the writable Actions backend, and in Phase 4 to the mirror). The asymmetry worth
 * spelling out: get here deliberately swallows every fault into a MISS, whereas
 * Phase 4's cleanup and any delete/overwrite decision MUST fail loud -- a swallowed
 * fault there reads as authoritative absence and would delete live data (Pitfall 7).
 */
export function createReleasesReadBackend(
  client: ReleaseReadClient,
): CacheBackend {
  return {
    async get(hash: string): Promise<GetResult> {
      try {
        const bytes = await client.fetchAsset(
          assetNaming.releaseAssetName(hash),
        );

        // A resolved undefined means the asset is genuinely absent -- the ordinary
        // cold-cache path, which stays silent. A rejection (caught below) means
        // something went wrong and is warned once.
        if (bytes === undefined) {
          return { kind: 'miss' };
        }

        return { kind: 'hit', bytes };
      } catch {
        // D-11 / SRV-05: EVERY fault -- 401/403/404/429, DNS failure, timeout, an
        // injected client that throws -- degrades to MISS at this port boundary, so
        // a read fault can never break a build and never yields wrong bytes
        // (Pitfall 9). The catch lives in the backend, not the client, so an
        // injected client that throws is covered too.
        warnOnce();

        return { kind: 'miss' };
      }
    },

    // D-02: read-only by construction. There is no local write path at all -- this
    // is the absence of a write path, not a disabled feature (TRUST-05). Declared
    // with zero parameters, mirroring createReadOnlyMemoryBackend.
    async put(): Promise<PutResult> {
      return 'forbidden';
    },
  };
}
