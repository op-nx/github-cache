import {
  resolveLocalReadToken,
  resolveRepoIdentity,
} from '../lib/local-context.js';
import * as assetNaming from '../lib/release-asset-name.js';
import { shardTag } from '../lib/retention.js';
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

/** GitHub REST API origin. The asset download follows a 302 away from this host. */
const GITHUB_API = 'https://api.github.com';

/**
 * Upper bound (milliseconds) on any single GitHub REST fetch. Mirrors
 * HELPER_TIMEOUT_MS's rationale (local-context.ts) for the network leg: a stalled
 * TCP connection, a slow-loris partial response, or a proxy that accepts but never
 * completes would otherwise leave fetch pending for undici's multi-minute default
 * and wedge a cache lookup. A timeout-triggered AbortError degrades to a warned
 * MISS at the port boundary (SRV-05, D-11) -- a bounded fault, never a hang. A
 * parallel constant, not a reuse of HELPER_TIMEOUT_MS: the subprocess and network
 * bounds are independent concerns that happen to share a value today. Native
 * AbortSignal.timeout (Node 24) keeps this zero-dependency (D-01/D-03).
 */
const FETCH_TIMEOUT_MS = 5000;

/**
 * Headers for a GitHub JSON metadata call: a bearer Authorization plus the versioned
 * JSON accept header. The token is interpolated ONLY here and in the asset download
 * below, and never logged or echoed (D-11).
 */
function githubJsonHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  };
}

/**
 * The real default ReleaseReadClient (D-03): the authenticated GitHub REST read
 * sequence over the native global fetch -- no HTTP dependency (D-01 zero-dep-lean).
 * This is the ONLY production ReleaseReadClient; the fake seam from Plan 01 is
 * test-only, and selectBackend always constructs the reader with this real client.
 *
 * fetchAsset resolves the token, then the repo identity, and only THEN issues any
 * request. When either resolves undefined it returns undefined with NO fetch made:
 * that is the D-09 no-anonymous guarantee (a private repo is never probed
 * unauthenticated -- never a silent drop to the 60/hr tier) and the D-10
 * never-guess-a-repo rule. The async resolution lives HERE, at get-time, not at
 * selectBackend construction -- which is exactly what lets selectBackend stay
 * synchronous and zero-arity (TRUST-05).
 *
 * Fault handling is deliberately SPLIT so the port keeps its "warn on fault, silent
 * on absent" discipline: a 404 (shard or asset genuinely absent -- the ordinary cold
 * cache) returns undefined, while ANY other non-ok status (401/403/429/5xx) THROWS.
 * The port boundary (createReleasesReadBackend.get) owns the never-throw guarantee
 * and degrades every throw to a warned MISS, so this client may throw freely
 * (RESEARCH Pattern 3). Discrimination is STRUCTURAL on res.status only, never body
 * text (D-11); there is no fault taxonomy and no retry/backoff -- every fault is a
 * MISS. The status codes in the thrown messages are safe; the token never is.
 */
export function createReleasesReadClient(
  env: NodeJS.ProcessEnv = process.env,
): ReleaseReadClient {
  // ME-01: memoize token and repo-identity resolution per client instance. Both are
  // invariant for the process lifetime, yet Nx issues one get() per distinct task
  // hash -- potentially hundreds per build -- and each would otherwise respawn gh /
  // git credential fill / git remote. Caching the PROMISE (not the value) also
  // collapses concurrent first-use calls onto one in-flight resolution. Resolution
  // still happens at get-time, not at selectBackend construction, so selectBackend
  // stays synchronous and zero-arity (TRUST-05); the cache is per instance, never
  // global.
  let cachedToken: Promise<string | undefined> | undefined;
  let cachedRepo: Promise<string | undefined> | undefined;

  return {
    async fetchAsset(assetName: string): Promise<Buffer | undefined> {
      // D-09 no-anon: resolve the token BEFORE any request. No token -> undefined
      // with zero fetches, so a private repo is never probed unauthenticated.
      cachedToken ??= resolveLocalReadToken(env);
      const token = await cachedToken;

      if (token === undefined) {
        return undefined;
      }

      // D-10: resolve the repo identity next, still before any request. Unresolved
      // -> undefined with no fetch; the reader never guesses another repo's namespace.
      cachedRepo ??= resolveRepoIdentity(env);
      const repo = await cachedRepo;

      if (repo === undefined) {
        return undefined;
      }

      // 1. Resolve the shard release by tag. A 404 here is the ordinary cold-cache
      // MISS -- the shard release has not been published yet.
      const releaseResponse = await fetch(
        `${GITHUB_API}/repos/${repo}/releases/tags/${shardTag()}`,
        {
          headers: githubJsonHeaders(token),
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        },
      );

      if (releaseResponse.status === 404) {
        return undefined;
      }

      if (!releaseResponse.ok) {
        throw new Error(
          `github-cache: release lookup failed with status ${releaseResponse.status}`,
        );
      }

      const release = (await releaseResponse.json()) as { id: number };

      // 2. Paginate the assets endpoint. NEVER read the inline release.assets array
      // -- it is a non-paginated first-page snapshot, so a near-cap shard would read
      // real HITs as MISSes (Pitfall 4). Increment page until a short (< 100) page.
      let asset: { id: number } | undefined;

      for (let page = 1; asset === undefined; page++) {
        const listResponse = await fetch(
          `${GITHUB_API}/repos/${repo}/releases/${release.id}/assets?per_page=100&page=${page}`,
          {
            headers: githubJsonHeaders(token),
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          },
        );

        if (listResponse.status === 404) {
          return undefined;
        }

        if (!listResponse.ok) {
          throw new Error(
            `github-cache: asset list failed with status ${listResponse.status}`,
          );
        }

        const batch = (await listResponse.json()) as {
          id: number;
          name: string;
        }[];
        asset = batch.find((candidate) => candidate.name === assetName);

        if (batch.length < 100) {
          break;
        }
      }

      if (asset === undefined) {
        return undefined;
      }

      // 3. Download by asset id. GitHub answers with a 302 to signed storage; native
      // fetch AUTO-FOLLOWS it and DROPS Authorization on that cross-origin hop
      // (whatwg/fetch#1544). The signed target carries its own auth, so re-attaching
      // the header would leak the token. Do NOT set redirect:'manual' and do NOT
      // re-attach Authorization after the redirect.
      const downloadResponse = await fetch(
        `${GITHUB_API}/repos/${repo}/releases/assets/${asset.id}`,
        {
          headers: {
            authorization: `Bearer ${token}`,
            accept: 'application/octet-stream',
          },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        },
      );

      if (downloadResponse.status === 404) {
        return undefined;
      }

      if (!downloadResponse.ok) {
        throw new Error(
          `github-cache: asset download failed with status ${downloadResponse.status}`,
        );
      }

      return Buffer.from(await downloadResponse.arrayBuffer());
    },
  };
}
