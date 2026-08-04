import * as core from '@actions/core';
import {
  createActionsCacheBackend,
  createReadOnlyActionsCacheBackend,
} from '../backend/actions-cache-backend.js';
import { createReadOnlyMemoryBackend } from '../backend/memory-backend.js';
import {
  createReleasesReadBackend,
  createReleasesReadClient,
} from '../backend/releases-backend.js';
import type { ReadableBackend, WritableBackend } from '../backend/types.js';
import {
  GITHUB_REPOSITORY_PATTERN,
  resolveGitHubToken,
} from './github-identity.js';
import { isWriteTrusted } from './trust.js';

// GITHUB_REPOSITORY_PATTERN and resolveGitHubToken live in the ./github-identity.js
// leaf module (extracted to break the releases-backend -> local-context ->
// select-backend cycle); selectBackend uses them internally below. Consumers import
// them from ./github-identity.js directly -- this module no longer re-exports them.

/**
 * The single context-derived backend selection point (D-01, TRUST-05). RW-vs-RO
 * is which factory constructs the backend, decided entirely from runtime
 * context, never a caller-facing mode flag -- the only argument is the
 * (injectable) env bag, and no property in it can request the writable backend.
 *
 * Untrusted context returns the read-only backend; trusted context validates the
 * repository identity fail-closed, resolves the token, and only then constructs
 * the writable Actions-cache backend -- unless the workflow author has DECLINED
 * write for this leg via `CACHE_READ_ONLY` (TRUST-14), the last branch below.
 *
 * THE KNOB IS SAFE TO NAME HERE. This block previously refused to, on the grounds that
 * "the 'it is last' guarantee is checked mechanically by first-occurrence position, so a
 * second mention up here would defeat the check". No such check existed -- it was an ad-hoc
 * `indexOf` comparison run once during plan 13-03 that never became a clause. It exists now,
 * in select-backend.spec.ts, and it reads the COMMENT-STRIPPED source, so prose cannot
 * satisfy or break it and the documentation cost is gone.
 */
export function selectBackend(
  env: NodeJS.ProcessEnv = process.env,
): ReadableBackend | WritableBackend {
  if (!isWriteTrusted(env).trusted) {
    // The local/untrusted branch returns the real cross-context GitHub Releases
    // reader (D-01), constructed with the real default client. selectBackend stays
    // SYNCHRONOUS: the async token and repo-identity resolution defer into the
    // client's fetchAsset (run at get-time), never at construction -- which is what
    // keeps Function.length at 0 and the serve.ts call site synchronous (TRUST-05).
    // The env bag is threaded through so the client resolves against the injected
    // environment. Read-only by construction (a ReadableBackend with no put).
    return createReleasesReadBackend(createReleasesReadClient(env));
  }

  if (!GITHUB_REPOSITORY_PATTERN.test(env.GITHUB_REPOSITORY ?? '')) {
    // Fail-closed construction guard (server.ts:62-66 precedent): a corrupted
    // repository identity in a write-trusted context must fail loudly rather than
    // resolve into some other repository's cache namespace.
    throw new Error(
      'selectBackend: GITHUB_REPOSITORY must be a valid owner/name in a write-trusted context (TEST-01)',
    );
  }

  if (resolveGitHubToken(env) === undefined) {
    // Degrade, do NOT throw: a merely-unwired workflow token must not break the
    // build. A malformed repository identity (above) is a misconfiguration and
    // does throw; an absent token is just a not-yet-write-capable context.
    return createReadOnlyMemoryBackend();
  }

  if (env.CACHE_READ_ONLY) {
    // ROLE, not TRUST (TRUST-14, D-02a). `push` and same-repo `pull_request` are both
    // correctly write-TRUSTED and GitHub keeps them fully read-write, so producer-vs-consumer
    // ROLE is not derivable from any GitHub-supplied env fact -- and the 2026-06-26
    // read-only-cache changelog exposes no per-job lever. The workflow author supplies the one
    // thing the runner cannot.
    //
    // POSITION IS THE GUARANTEE, and it is now checked rather than asserted -- do NOT move
    // this check earlier. Every
    // branch above has already returned a read-only backend or thrown, so the only outcome
    // still reachable here is the writable one. The knob is therefore structurally incapable
    // of WIDENING: it cannot resurrect the Releases branch, the fail-closed throw, or the
    // memory-degrade branch, because control never reaches this line from any of them. That
    // is what makes it TRUST-05-compatible -- TRUST-05 forbids REQUESTING write, it does not
    // forbid DECLINING it -- and the property is asserted mechanically by the narrowing table
    // in select-backend.spec.ts rather than read off this comment.
    //
    // Bare truthiness, matching retention.ts:118's opt-in idiom -- never an exact-string
    // equality against a 'true' literal, and no 'true'/'1'/'yes' parser. On a one-way ratchet
    // truthiness is the fail-SAFE direction: a value of `flase` still narrows, whereas an
    // exact-string parser would silently restore the WRITABLE backend on a typo. Only unset
    // or the empty string leaves the writable outcome intact. Guarded on two levels: the
    // truthiness it.each rows in select-backend.spec.ts prove the BEHAVIOUR ('0', 'false',
    // 'no', 'off', 'FALSE', ' ' all still narrow), and a textual clause in the same file
    // rejects any equality comparison against the knob. The prose-not-quote convention is
    // kept for the second one's benefit -- that clause used to be claimed here and did not
    // exist, so do not restore the claim without it.
    //
    // An env-bag KEY, never a parameter: selectBackend.length stays 0 (TRUST-05), and no
    // `readOnly` field goes on ServeOptions (serve.ts:22-28) or on a backend factory (D-03).
    //
    // SAY SO IN THE LOG, because bare truthiness is fail-SAFE for the CACHE and fail-CONFUSING
    // for the operator. The two directions are not symmetric: an adopter who writes
    // `CACHE_READ_ONLY: false` on a PRODUCER job -- reading the name as a boolean, which is how
    // every other `*_READ_ONLY` env var in the ecosystem reads -- gets the narrowing anyway,
    // every PUT answered 403, exit 0, and a cache that is permanently cold. Before this line
    // there was NOTHING to find: selectBackend emitted nothing, serve() logs only the listen URL
    // and the token, and a leg that DECLINED the write was indistinguishable in its log from one
    // that never had it. docs/configuration.md already names that trap; this is the signal that
    // makes it diagnosable from the job log instead of only from the docs.
    //
    // info, NOT warning, and the level is the judgement rather than an oversight. Every other
    // silent-degradation path in this package warns (the saveCache -1 ambiguity, the
    // all-restore-MISS run, the asset cap, an unparseable created_at) because each is a
    // SURPRISE. This one is a REQUEST: the workflow author asked for it, on purpose, on three
    // legs of every run in this repo alone. A warning there is an annotation on correct
    // configuration three times per run, which is how a project teaches its operators to
    // ignore annotations -- the same tripwire-that-fires-on-correct-work failure D-30 forbids.
    // The message names the CONSEQUENCE, not the setting, so the misconfigured-producer case is
    // greppable by what went wrong.
    core.info(
      'github-cache: CACHE_READ_ONLY is set, so this job serves the READ-ONLY Actions-cache backend and will NOT populate the cache -- every PUT is answered 403. Any non-empty value narrows, including "false" and "0". Unset the variable entirely to let this job write.',
    );

    return createReadOnlyActionsCacheBackend();
  }

  return createActionsCacheBackend();
}
