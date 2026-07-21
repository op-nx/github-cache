import {
  resolveLocalReadToken,
  resolveRepoIdentity,
} from '../lib/local-context.js';
import * as assetNaming from '../lib/release-asset-name.js';
import { resolveMaxAgeDays, shardTagsForWindow } from '../lib/retention.js';
import type { Hash } from '../lib/cache-key.js';
import type { GetResult, ReadableBackend } from './types.js';

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
 * T-03-03, T-03-06). The caught error is STILL never interpolated (helper stderr
 * can carry credential-adjacent material) -- the ONLY variable admitted is the
 * numeric HTTP status, which the fault-split throw sites already treat as safe to
 * surface. Including it lets a persistent misconfig (a 401/403 from a bad/expired
 * token or a missing contents:read scope) be told apart from a transient blip,
 * instead of one indistinguishable generic line before an all-MISS build. A
 * non-numeric/absent status keeps the original generic sentence. Modelled on
 * serve.ts's process-stream write, on stderr.
 */
function warnOnce(status?: number): void {
  if (warned) {
    return;
  }

  warned = true;

  const detail = typeof status === 'number' ? ` (HTTP ${status})` : '';
  process.stderr.write(
    `github-cache: GitHub Releases cache read failed${detail}; continuing with a cache miss.\n`,
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
): ReadableBackend {
  return {
    async get(hash: Hash): Promise<GetResult> {
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
      } catch (error) {
        // D-11 / SRV-05: EVERY fault -- 401/403/404/429, DNS failure, timeout, an
        // injected client that throws -- degrades to MISS at this port boundary, so
        // a read fault can never break a build and never yields wrong bytes
        // (Pitfall 9). The catch lives in the backend, not the client, so an
        // injected client that throws is covered too. Surface ONLY a numeric
        // status (safe; never the error message/body) so a persistent auth
        // misconfig is diagnosable.
        const status = (error as { status?: unknown }).status;
        warnOnce(typeof status === 'number' ? status : undefined);

        return { kind: 'miss' };
      }
    },

    // D-02: read-only by CONSTRUCTION -- there is no put method at all (ReadableBackend),
    // so a write is unrepresentable, not a disabled feature (TRUST-05). The server
    // answers a PUT routed to this backend with the contract's 403.
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
 * Upper bound (milliseconds) on the asset DOWNLOAD leg specifically. A cache
 * archive can be tens of MB up to the ~2 GiB release-asset ceiling, and
 * AbortSignal.timeout is an ABSOLUTE deadline -- reusing the 5s control-plane
 * bound (FETCH_TIMEOUT_MS) for the body transfer would abort a perfectly healthy
 * large download and degrade it to a warned MISS (needless rebuild), which is the
 * dominant realistic failure of the mirror read path. The small JSON metadata and
 * asset-list calls keep the tight 5s bound; only the binary transfer gets this
 * larger one. ponytail: fixed absolute ceiling. If a legitimately huge asset over
 * a slow link still trips it, upgrade to a per-chunk INACTIVITY timeout over
 * downloadResponse.body (reset an AbortController timer on each chunk) rather than
 * raising this constant further -- an inactivity bound has no size-dependent cap.
 */
const DOWNLOAD_TIMEOUT_MS = 300_000;

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
 * Fault-split for a GitHub REST response (D-11), centralizing the 404-vs-fault
 * contract each fetch site otherwise authored identically. Returns `true` for a 404
 * (genuine absence -- the caller's cue to try the next shard / MISS), `false` for a
 * 2xx (proceed); ANY other non-ok status THROWS with the numeric status attached
 * (never body text -- the port surfaces only the safe status).
 */
function assertOkOrAbsent(response: Response, what: string): boolean {
  if (response.status === 404) {
    return true;
  }

  if (!response.ok) {
    throw Object.assign(
      new Error(`github-cache: ${what} failed with status ${response.status}`),
      { status: response.status },
    );
  }

  return false;
}

/**
 * Resolve one asset from a SINGLE month-shard release, or undefined when the shard or the
 * asset is genuinely absent (a 404 at any step) -- the caller's cue to try the next shard
 * in the retention window (D-08). Every non-404 status still THROWS so the port degrades it
 * to a warned MISS: the "404 = absence, everything else is a fault" split is unchanged from
 * the Phase 3 single-shard reader, just scoped to one shard of the walk. Discrimination is
 * STRUCTURAL on res.status only (D-11); the status codes in thrown messages are safe, the
 * token never is.
 */
async function fetchAssetFromShard(
  repo: string,
  token: string,
  tag: string,
  assetName: string,
): Promise<Buffer | undefined> {
  // 1. Resolve the shard release by tag. A 404 here is the ordinary cold-cache MISS for
  // THIS shard -- the shard release has not been published in this month.
  const releaseResponse = await fetch(
    `${GITHUB_API}/repos/${repo}/releases/tags/${tag}`,
    {
      headers: githubJsonHeaders(token),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    },
  );

  if (assertOkOrAbsent(releaseResponse, 'release lookup')) {
    return undefined;
  }

  const release = (await releaseResponse.json()) as { id: number };

  // 2. Paginate the assets endpoint. NEVER read the inline release.assets array -- it is
  // a non-paginated first-page snapshot, so a near-cap shard would read real HITs as
  // MISSes (Pitfall 4). Increment page until a short (< 100) page.
  let asset: { id: number } | undefined;

  for (let page = 1; asset === undefined; page++) {
    const listResponse = await fetch(
      `${GITHUB_API}/repos/${repo}/releases/${release.id}/assets?per_page=100&page=${page}`,
      {
        headers: githubJsonHeaders(token),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );

    if (assertOkOrAbsent(listResponse, 'asset list')) {
      return undefined;
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

  // 3. Download by asset id. GitHub answers with a 302 to signed storage; native fetch
  // AUTO-FOLLOWS it and DROPS Authorization on that cross-origin hop (whatwg/fetch#1544).
  // The signed target carries its own auth, so re-attaching the header would leak the
  // token. Do NOT set redirect:'manual' and do NOT re-attach Authorization after the
  // redirect.
  const downloadResponse = await fetch(
    `${GITHUB_API}/repos/${repo}/releases/assets/${asset.id}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/octet-stream',
      },
      // Download leg gets the larger bound (DOWNLOAD_TIMEOUT_MS), not the 5s
      // control-plane deadline -- a multi-MB body legitimately outlasts 5s.
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    },
  );

  if (assertOkOrAbsent(downloadResponse, 'asset download')) {
    return undefined;
  }

  return Buffer.from(await downloadResponse.arrayBuffer());
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

      // D-08: walk the retention window newest-first. shardTagsForWindow is coupled to
      // resolveMaxAgeDays (the one CACHE_MIRROR_MAX_AGE_DAYS knob, shared with cleanup),
      // so the read window can never drift from the retention window. A 404 (shard or
      // asset absent) on one shard moves to the next; a non-404 fault throws (degraded to
      // a warned MISS at the port). Only exhausting every shard is a MISS -- so an asset
      // written before a month boundary is still resolved from the next month's context.
      for (const tag of shardTagsForWindow(resolveMaxAgeDays(env))) {
        const bytes = await fetchAssetFromShard(repo, token, tag, assetName);

        if (bytes !== undefined) {
          return bytes;
        }
      }

      return undefined;
    },
  };
}
