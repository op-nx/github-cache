import * as core from '@actions/core';
import { createReadOnlyActionsCacheBackend } from '../backend/actions-cache-backend.js';
import type { GetResult } from '../backend/types.js';
import {
  CACHE_KEY_PREFIX,
  isServerProducedKey,
  parseHash,
  type Hash,
} from '../lib/cache-key.js';
import {
  faultMessageForField,
  faultReason,
  hasFaultCode,
} from '../lib/octokit-fault-reason.js';
import { statusOf } from '../lib/octokit-status.js';
import { cachePlatform, releaseAssetName } from '../lib/release-asset-name.js';
import { shardTag } from '../lib/retention.js';

/**
 * The ~2 GiB per-asset Releases ceiling, which coincides with the server's 2 GB body
 * cap (D-12/ROBUST-02). Checked BEFORE any upload so the outcome is deterministic: an
 * artifact at or over this size fails the whole run loud, it is never truncated or
 * dropped. The exact boundary (>= vs >) is pinned by publish-mirror.spec.ts.
 */
export const RELEASE_ASSET_MAX_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * The per-release (per month shard) asset cap (D-11/ROBUST-05). A shard already holding
 * this many assets degrades a new entry to skip-and-warn -- a cache MISS-on-write -- and
 * never hard-fails the build. The cap tracks monthly write volume, independent of the
 * retention window.
 */
export const RELEASE_ASSET_CAP = 1000;

/**
 * D5's PARTIAL-case TARGET RATE: the value the miss proportion's Wilson lower bound must
 * REACH before the second warning below fires. It is not a raw cutoff on
 * `readMisses / scanned` -- it was one until the branch was regularised, and the change of
 * meaning is why the fixtures had to be rebuilt rather than moved. See that branch for the
 * measured baseline the rate is read against and for why the denominator is the full
 * enumeration.
 *
 * EXPORTED SO A SPEC CAN PIN THE VALUE -- not so it can derive a boundary from it, and
 * the distinction matters because the weaker of those two is what actually shipped. The
 * boundary fixtures in `publish-mirror.spec.ts` are computed for THIS rule at THIS rate:
 * a 10-entry enumeration with 9 misses (bound 0.5958, fires) and with 8 (bound 0.4902,
 * silent). The second sits 0.0098 under the rate, which is what lets the pair catch an
 * off-by-one or a mis-transcribed z. Changing this constant INVALIDATES those fixtures
 * rather than merely moving them, so it must be changed here and in them together -- which
 * is exactly what the pin makes loud.
 */
export const PARTIAL_READ_MISS_WARN_RATIO = 0.5;

/**
 * The two-sided 95% normal quantile. Named rather than inlined so the one number a reader
 * would want to check is checkable, and NOT tuned to anything in this repository -- which
 * is the property that matters for a rule that ships to consumers.
 */
const WILSON_Z = 1.96;

/**
 * The Wilson score interval's LOWER endpoint for `successes` out of `trials`, used by the
 * partial-miss branch below as a SMALL-SAMPLE REGULARISER and never as a confidence bound.
 *
 * That distinction is not pedantry. A restore MISS is deterministic given (entry cohort,
 * leg platform) -- the cache version either matches or it does not -- so there is no
 * superpopulation for an interval to cover and no estimand for it to be a bound ON.
 * Calling it a confidence bound in a comment would ship a false justification, which is
 * the exact defect class the previous version of that branch's comment was rewritten to
 * remove.
 *
 * What it does do, which is why it is here: it shrinks the observed proportion toward zero
 * by an amount that itself shrinks as `trials` grows, so a short enumeration cannot trip
 * the branch on a couple of misses while a long one trips at close to its raw rate. The
 * rule is then SCALE-INVARIANT -- it needs no constant beyond the target rate and z, and
 * no minimum-N floor, because the bound cannot reach one half below four trials at all and
 * at four only a 4/4 miss clears it, which the total-case gate above already owns.
 *
 * `trials === 0` returns 0 rather than dividing by it. The caller's `readMisses > 0` clause
 * already makes that unreachable; this keeps the helper total anyway.
 *
 * NOT EXPORTED, and the specs drive it through `publishMirror` rather than directly. A
 * spec that called it would pin the arithmetic without proving the branch reads it, and
 * the branch is the thing under test.
 */
function wilsonLowerBound(successes: number, trials: number): number {
  if (trials === 0) {
    return 0;
  }

  const proportion = successes / trials;
  const z2 = WILSON_Z * WILSON_Z;
  const centre = proportion + z2 / (2 * trials);
  const margin =
    WILSON_Z *
    Math.sqrt(
      (proportion * (1 - proportion)) / trials + z2 / (4 * trials * trials),
    );

  return (centre - margin) / (1 + z2 / trials);
}

// The restore-result the engine consumes IS the CacheBackend's GetResult
// (actionsCache.get returns it), so re-export the single-source type from
// backend/types instead of re-declaring a structurally-identical copy that would
// silently diverge if the canonical hit variant ever grew a field (I7). Consumers
// (publish-mirror.spec) keep importing GetResult from this module unchanged.
export type { GetResult };

/** An Actions-cache entry as the publisher needs it: only its key drives the mirror. */
export interface CacheEntry {
  readonly key: string;
}

/** A GitHub Release as the publisher needs it: its id addresses the shard's assets. */
export interface PublishRelease {
  readonly id: number;
}

/**
 * The narrow injected client (D-02/D-04 seam, the ReleaseReadClient precedent). Each
 * method wraps a single Octokit call in the real 04-06 adapter and is free to throw an
 * Octokit-shaped fault carrying a numeric `status`. This module imports NO @octokit/rest:
 * the engine is pure orchestration behind this seam, so the full fault matrix is
 * unit-tested with a fault-shaped fake and no live network.
 *
 * listReleaseAssets returns the FULLY materialized set of asset names (the real adapter
 * paginates, never reading a release's inline `assets` first-page snapshot -- Pitfall 4).
 * getReleaseByTag throws a 404 when the shard does not exist yet. createRelease throws a
 * 422 for SEVERAL distinct reasons, only one of which is "another matrix leg created the
 * tag first": GitHub multiplexes six `errors[].code` values onto that one status, and
 * policy rejections arrive as `custom`. Which one it is can only be read from the BODY --
 * see `lib/octokit-fault-reason.ts` and the ensureShardRelease catch below.
 *
 * uploadReleaseAsset's `label` is free-form Release METADATA (OBS-03), deliberately
 * outside the lookup name -- see the construction site below for what it does and does
 * NOT claim. Positional rather than an options object, following the `ref` 4th positional
 * already shipped on the sibling seam's createPublishClient: one call site, one
 * implementation.
 */
export interface PublishClient {
  listCacheEntries(): Promise<CacheEntry[]>;
  getReleaseByTag(tag: string): Promise<PublishRelease>;
  createRelease(tag: string): Promise<PublishRelease>;
  listReleaseAssets(releaseId: number): Promise<string[]>;
  uploadReleaseAsset(
    releaseId: number,
    name: string,
    bytes: Buffer,
    label: string,
  ): Promise<void>;
}

/** Run counts for the OBS-01 summary (D-17); the bin emits the summary from these. */
export interface PublishResult {
  /**
   * DISTINCT server-produced hashes enumerated (listCacheEntries returns one row per
   * (key, version) and the rows are deduped below, so a key saved under two archive
   * versions counts once), MINUS any single-use CI seed belonging to another run (D1, see
   * `isOtherRunsSeed`). The denominator the other counts are read against.
   *
   * That subtraction SHRINKS this number, so figures recorded before the D1 filter are not
   * comparable to these -- the 149 ubuntu / 150 windows readings taken on run 31281406708
   * are pre-filter. Stated here rather than only at the filter site because this field doc
   * is where a reader of the OBS-01 summary arrives, and a reported number whose definition
   * lives somewhere other than where it is read is the exact defect D4 was raised to fix.
   */
  readonly scanned: number;
  readonly mirrored: number;
  readonly skipped: number;
  /**
   * Restore MISSes: a strict SUBSET of `skipped`, never a sibling of it -- the miss
   * branch below increments BOTH. Reported separately because it is the one number that
   * separates "nothing to mirror" from "this leg's Actions-cache read scope regressed",
   * two states that otherwise look identical on a green run: @actions/cache logs a
   * restore MISS at core.debug only, so the distinction needed ACTIONS_STEP_DEBUG and a
   * log dive before this existed.
   */
  readonly readMisses: number;
  /**
   * Entries skipped because their asset name was ALREADY in the shard: like `readMisses`,
   * a strict SUBSET of `skipped` and never a sibling of it -- both membership branches
   * below increment BOTH. Reported separately because one number was meaning two things,
   * and that conflation is the direct reason a 42% restore-MISS rate went unread for 11
   * days: `restore-MISS (of skipped)` counted unrestorable entries, while the bulk of
   * `skipped` was ordinary first-write-wins no-ops on entries that were fine.
   *
   * NOT the duplicate-upload race. That branch is a WRITE-race outcome, not an
   * enumeration-cost signal, and folding it in here would make this number stop answering
   * the one question it exists for.
   */
  readonly alreadyPresent: number;
  readonly failed: number;
}

/**
 * `now` is a test-injection knob only (no runtime mode surface) and pins the shard tag.
 *
 * `runId` is NOT a knob: it is this workflow run's id, and the seed filter below is a
 * no-op without it. `runPublish` reads it from `process.env.GITHUB_RUN_ID` at the one
 * call site. It arrives as an OPTION rather than an ambient read because this engine is
 * pure orchestration behind an injected client and `publish-mirror.spec.ts` drives it
 * directly -- an env read here would put a global in the middle of that seam. Optional so
 * every existing caller and spec keeps compiling; the cost of that is a filter that
 * silently fails open when the edge is dropped, which is why `action/index.spec.ts` pins
 * the forwarding itself rather than leaving it to the engine-level cases.
 */
export interface PublishOptions {
  readonly now?: Date;
  readonly runId?: string;
}

/**
 * The three CI seed marker words, and the ONLY thing separating a single-use seed from
 * real cache content. Each is a hex-LETTER-leading word CI prepends to the workflow run
 * id: `cafe` (consumer-smoke), `bead` (dogfood-seed, D2) and `feed` (the publish leg's
 * own mirror seed, followed by its OS index). Both competing key spaces -- run ids and Nx
 * task hashes -- are all-decimal, so a real task hash can never carry one of these words
 * and can never be misread as a seed.
 *
 * THESE THREE LITERALS ARE DUPLICATED, and that is ACCEPTED rather than overlooked --
 * recorded here so the next reader does not re-derive it and "fix" it. Two are authored in
 * `ci.yml` (`RUN_HASH: cafe...` and both dogfood jobs' `hash: bead...`) and the third
 * lives inside `mirrorSeedHash`'s template, with no gate tying any of them to this array.
 * The drift direction is FAIL-OPEN: a renamed marker word simply stops being filtered,
 * which is today's behaviour and not a new fault. And the one literal that COULD be
 * derived instead -- the publish leg's own word, since `mirrorSeedHash` is exported and
 * this file already imports from `lib/` -- would cover one family of three while coupling
 * this filter to a helper whose own docblock says its ENCODING must change if a tenth OS
 * discriminator is ever added.
 */
const SEED_MARKER_WORDS = ['cafe', 'bead', 'feed'] as const;

/**
 * "Is this a single-use CI seed belonging to some OTHER run?" -- D1, and the whole point
 * of this task. A seed that misses on restore can never be mirrored, so it is never in the
 * shard, so it is enumerated and re-restored on EVERY subsequent run and can never
 * succeed: 48 of the 63 restore MISSes on run 31281406708 were prior runs' seeds.
 *
 * The rule is FAMILY-AGNOSTIC on purpose: marker-prefix AND does-not-end-with-this-run-id,
 * with no per-family parse and nothing derived from the OS tuple. Ending with the run id
 * is what admits every `feed<i>` index rather than only the running leg's, and that is
 * REQUIRED, not incidental -- `max-parallel: 1` runs ubuntu first, so the windows leg
 * enumerates the ubuntu leg's seed too and C1 needs it mirrored (publish-verify reads its
 * own leg's seed back out of the SHARD).
 *
 * FAIL-OPEN when the run id is unavailable: the predicate answers false for everything and
 * the enumeration is exactly what it is today. Dropping an entry is the direction C1
 * forbids; admitting one it could have skipped is merely the status quo. The residual of
 * the suffix test errs the same safe way -- a prior run whose id happens to END with this
 * run's id is admitted, never dropped.
 */
function isOtherRunsSeed(hash: string, runId: string | undefined): boolean {
  if (runId === undefined || runId === '') {
    return false;
  }

  return (
    SEED_MARKER_WORDS.some((word) => hash.startsWith(word)) &&
    !hash.endsWith(runId)
  );
}

/**
 * Get-or-create the month-shard release, tolerating a concurrent-create race across the
 * per-OS matrix legs (D-05). Structural fault discrimination throughout (ROBUST-01):
 * only a 404 on the lookup means "not created yet"; a 422 on create means "another leg
 * created the tag first" ONLY when the body explicitly says `already_exists`. Every other
 * status, and every other 422, is a REAL fault and propagates, never inferred as absence.
 *
 * THE STATUS-ONLY READING WAS FALSIFIED BY MEASUREMENT, not by review. On run 30773689490
 * both publish legs took the 422-means-race path, and afterwards there was NO
 * `cache-mirror-202608` release, no such tag ref (exit 1, with `cache-mirror-202607` as a
 * passing positive control) and no draft -- both tags quoted as they were PROBED, under the
 * PRE-RENAME tag scheme. A 422 cannot mean already_exists when the
 * resource provably does not exist. The unguarded re-GET then 404'd and killed the job on
 * a bare Not Found that named neither the tag nor the operation. Commit `e96670e` fixed
 * exactly this defect at the upload site one level down, and its commit body CLEARED this
 * site by reasoning rather than by measuring it -- "the ensureShardRelease 422 branch is
 * untouched, that one is a genuine race" -- which is how the sibling became the next
 * blocker. When a defect CLASS is fixed, sweep every instance of it.
 *
 * ONE 422 IS NEITHER A RACE NOR A FAULT WORTH FAILING FOR: GitHub reporting that the tag
 * NAME was used by an immutable release. That is permanent and unfixable from inside a run
 * -- an immutable release published the name once and, per GitHub's documented behaviour,
 * deleting the release does not release the name (the resurrection-attack note extends the
 * burn past the repository). No retry, no other leg, and no later month can make THIS tag
 * creatable, so failing the whole publish job converts a shard that cannot exist into a red
 * build for every subsequent push. `undefined` therefore means "shard skipped, nothing
 * mirrorable", and the caller warns ONCE and skips the rest of the batch. Everything else,
 * including every other 422, still throws.
 */
async function ensureShardRelease(
  client: PublishClient,
  tag: string,
): Promise<number | undefined> {
  try {
    const release = await client.getReleaseByTag(tag);

    return release.id;
  } catch (error) {
    if (statusOf(error) !== 404) {
      throw error;
    }
  }

  try {
    const release = await client.createRelease(tag);

    return release.id;
  } catch (error) {
    const reason = faultReason(error);

    // SCANNED ACROSS THE WHOLE `errors[]`, never `reason.code`, which is the FIRST string
    // code anywhere in the array and therefore order-dependent in both directions. See
    // hasFaultCode: an `already_exists` sitting behind an unrelated earlier code would make
    // a genuine create race fatal here, killing the run on the one case this branch exists
    // to absorb.
    if (statusOf(error) === 422 && hasFaultCode(error, 'already_exists')) {
      // GUARDED, even on a genuine race. This re-GET is a read-after-write: it can 404
      // transiently right after another leg's create, and get-by-tag does not resolve
      // DRAFT releases at all. Unguarded it propagates octokit's bare "Not Found", which
      // is what run 30773689490 actually died on -- a message naming neither the tag nor
      // the operation, one job away from any reader who could act on it.
      try {
        const release = await client.getReleaseByTag(tag);

        return release.id;
      } catch (reReadError) {
        throw new Error(
          `github-cache: the re-read of shard release ${tag} after an already_exists 422 failed (status ${statusOf(reReadError) ?? 'unknown'}).`,
          { cause: reReadError },
        );
      }
    }

    // THE TAG NAME IS BURNED: skip the shard loudly instead of failing the run. The
    // predicate is a 422 carrying an `errors[]` entry whose `field` is `tag_name` and whose
    // message contains `immutable release` -- read through the FIELD-SCOPED accessor and not
    // through `reason.message`, which returns the first entry carrying a message and on the
    // measured payload is the `pre_receive` DECOY, so the obvious substring test could never
    // have fired.
    //
    // `immutable release` and not the whole measured sentence: the wording is UNDOCUMENTED
    // vendor text (GitHub documents the immutability behaviour and never the error string),
    // so the substring has to survive a tense or voice change while staying unique to the
    // immutability rejection. Not the bare word `immutable` either -- that would also match a
    // future `tag_name`-scoped message about immutability that is not a burn.
    //
    // FAIL-CLOSED in every direction. A rewording, a dropped or renamed `field`, a
    // non-string message, and an unreadable body all miss this predicate and fall through to
    // the throw below. The `pre_receive` decoy is excluded TWICE, and both reasons are load
    // bearing rather than one being a restatement: STRUCTURALLY its field is not `tag_name`,
    // so the accessor never reads its message at all; and TEXTUALLY its message carries no
    // `immutable release`. Its own condition -- a genuine creations-restricted ruleset -- is
    // fixable by a human editing repo settings and must stay fatal.
    //
    // Only the tag, the numeric status and GitHub's OWN tag_name-entry message are logged --
    // never a token, never a raw workflow-command string.
    const burnedTagMessage = faultMessageForField(error, 'tag_name');

    if (
      statusOf(error) === 422 &&
      burnedTagMessage !== undefined &&
      burnedTagMessage.includes('immutable release')
    ) {
      core.warning(
        `github-cache: month-shard release ${tag} cannot be created -- GitHub rejected the tag name (status 422, message ${burnedTagMessage}). The name is permanently burned by an immutable release, so this leg mirrors NOTHING and skips every entry rather than failing the run; publish-verify is the downstream signal. Rotate the month-shard tag scheme to a prefix whose names are not burned.`,
      );

      return undefined;
    }

    // THIS FAULT THROWS while D-12's oversized-asset fault only counts, and the two are
    // not in contradiction -- they are the two halves of the whole-run-vs-per-item split
    // (D-13) this file already draws. An oversized asset is a PER-ITEM fault: the rest of
    // the batch is still mirrorable, so counting it keeps the later entries and the
    // accumulated counts. A shard that cannot be CREATED makes every remaining upload
    // impossible, so isolating it would produce 32 identical warnings -- noise, not
    // signal. The status quo already threw here, so propagating is not a regression.
    //
    // The ORIGINAL error is rethrown rather than the annotation: `statusOf` stays readable
    // downstream, and the existing whole-run-throw cases stay honest.
    //
    // Only the tag, the numeric status, GitHub's own code and GitHub's own message are
    // logged -- never a token, never a raw workflow-command string.
    //
    // The MESSAGE prefers the `tag_name`-scoped entry over `reason.message`, which is the
    // first entry carrying one ANYWHERE in the array. On a payload carrying both entries
    // that first one is the `pre_receive` decoy, so this log printed the generic ruleset
    // wording for precisely the tag-name failure it exists to diagnose -- the string a future
    // reader would take away from the job log. On a decoy-only payload the two are identical,
    // so this is a strict improvement with no behaviour change where nothing was wrong.
    core.error(
      `github-cache: createRelease ${tag} was rejected (status ${statusOf(error) ?? 'unknown'}, code ${reason.code ?? 'unknown'}, message ${burnedTagMessage ?? reason.message ?? 'unknown'}); this is NOT a create race -- only an explicit already_exists is.`,
    );

    throw error;
  }
}

/**
 * The out-of-band publish/mirror engine (D-02/D-03/D-05/D-11/D-12, TEST-03,
 * ROBUST-01/02/05, TRUST-07, OBS-01). Enumerate default-branch Actions-cache entries,
 * mirror ONLY the server-produced keys via isServerProducedKey (D-16/D-08/TRUST-08),
 * restore each hash's bytes on this leg, and upload to the current-month shard
 * release without ever overwriting:
 *
 * - Enumeration (whole-run): a listCacheEntries fault propagates so the bin fails loud.
 * - Filter (D-08/TRUST-08): only server-produced keys (prefix + a valid HASH_PATTERN
 *   suffix) are mirrored, the prefix sliced to the hash; a foreign key OR a
 *   `nx-cache-<non-hex>` key is filtered out BEFORE restore, never mirrored as a public
 *   asset (the hardening the Phase 4 startsWith-only subset lacked).
 * - Seed filter (D1): a SECOND, narrowing enumeration filter drops any single-use CI seed
 *   carrying some OTHER run's id, so a prior run's seed is no longer restored on every
 *   push forever (48 of the 63 restore MISSes on run 31281406708 were exactly that). It
 *   changes what this function is handed, and it SHRINKS `scanned` -- see `isOtherRunsSeed`
 *   and the `scanned` field doc for why pre-filter figures are not comparable to post-.
 * - Membership-before-restore (D3): an entry whose asset name is already in the resolved
 *   shard is skipped with NO Actions-cache round-trip, since the name is a function of the
 *   hash alone. It changes WHEN -- and whether -- the Actions cache is touched at all; the
 *   guard's own comment carries the three aggregate outcomes that shifts.
 * - Restore (D-03): an entry this leg cannot restore -- evicted, or written under a
 *   different cache version -- MISSes and is skipped, never an error.
 *   Restore is NOT same-OS. VER-01 made the archive path OS-invariant and VER-03 set
 *   `enableCrossOsArchive`, so a foreign-OS entry is restorable here and is
 *   mirrored rather than skipped. This header claimed the opposite for the whole of
 *   Phase 9, 90 lines above the same file's own corrected statement of it at the
 *   `mirrored-by` hoist -- because publish-mirror.ts sat only in EDITED_FILES, whose
 *   scan is the producer-attribution one and reads no same-OS claim at all. It now
 *   carries a DOCS_08_SITES row of its own. The shard release is ensured LAZILY, only
 *   once there is a restorable entry, so an all-MISS leg never creates an empty release.
 * - ~2 GiB boundary (D-12/ROBUST-02): a pre-upload bytes.byteLength check counts an
 *   oversized entry as a per-item failure (core.error + `failed++` + continue) BEFORE any
 *   upload -- never truncate or drop. The loop does not abort, so the accumulated counts
 *   and the later entries survive; the aggregate `failed > 0` check below then fails the
 *   run loud, so D-12's "never truncate, never silently drop, fail the run" holds -- only
 *   the mechanism moved from a throw to the counter three lines away (a mid-loop throw
 *   discarded every count and bypassed the aggregate check).
 * - 1000-asset cap (D-11/ROBUST-05): a shard at the cap skips-and-warns (core.warning),
 *   never hard-fails.
 * - First-write-wins (D-05/TRUST-07): a name already present is a benign no-op, and the
 *   byte-identity that makes it benign SURVIVES CORR-02 with a DIFFERENT reason. It used
 *   to rest on OS-namespacing -- each leg owned its own suffix, so two legs could not
 *   collide on a name at all. That reason is gone with the suffix. What holds now: for a
 *   given hash the Actions cache holds exactly ONE entry, and every publish leg RESTORES
 *   that one entry and uploads it VERBATIM without re-executing the task, so the uploaded
 *   bytes are byte-identical no matter which leg wins the race. A duplicate-upload race
 *   is likewise benign -- but ONLY when GitHub's 422 body says `already_exists`. The 422
 *   STATUS alone does not mean a duplicate, and reading it that way is what let a shard
 *   that rejects every upload report a green publish leg (see the upload catch below).
 *   A real per-item fault (401/403/429/5xx, and every non-already_exists 422) is
 *   annotated and counted but isolated so the rest of the batch still mirrors (D-13
 *   per-item vs whole-run). The residual -- arbitration between NON-identical payloads --
 *   becomes reachable only once a SECOND producer exists, which is a later phase's write
 *   decision and not this one's (T-10-04).
 * - Aggregate fail-loud (OBS-01/D-15): a nonzero `failed` count calls core.setFailed after
 *   the batch, so a systemic upload regression (a token whose permissions regressed, a
 *   sustained upload-phase outage) fails the job instead of reporting CI green -- mirroring
 *   cleanupMirror's aggregate check. Only the count is logged, never a token.
 *
 * Returns the scanned/mirrored/skipped/readMisses/alreadyPresent/failed counts; the bin
 * emits the OBS-01 summary from them.
 */
export async function publishMirror(
  client: PublishClient,
  options: PublishOptions = {},
): Promise<PublishResult> {
  const tag = shardTag(options.now);
  // THE READ-ONLY FACTORY, because this engine only ever READS. It calls `.get()` on one
  // line and never `.put()` -- it mirrors Actions-cache bytes OUT to Release assets, so a
  // write path here is capability it has no use for. Constructing the writable backend was
  // the pre-D-01 shape carried forward: the read-only factory did not exist when this line
  // was written, and it is the one read-only Actions consumer the split never migrated.
  // Both factories share the same `get` closure (the writable one spreads this one), so the
  // restore behaviour, the cache version and the VER-04/VER-07 construction guards are
  // identical -- the only thing that changes is that `put` is now unrepresentable here.
  const actionsCache = createReadOnlyActionsCacheBackend();

  const entries = await client.listCacheEntries();
  // Dedup to DISTINCT hashes. listCacheEntries returns one row per (key, version), so a
  // key saved under two archive versions enumerates twice and would be restored twice
  // (12 redundant round-trips per leg in the run that prompted this).
  //
  // Safe for the all-restore-MISS gate below, which reads hashes.length: the restore
  // outcome is a PURE FUNCTION of the hash -- actionsCache.get(hash) derives both the
  // archive path and the cache key from `hash` alone and never sees the `version` field
  // (listCacheEntries maps each row to { key } only) -- so every row of a given hash
  // returns the same kind. readMisses and hashes.length are therefore the same weighted
  // sum over the same multiplicity vector, and multiplicity cancels out of the equality:
  // both before and after this dedup the gate means exactly "every DISTINCT hash missed".
  // It also stops a duplicate inflating `skipped` through the already-present branch.
  const hashes: Hash[] = [
    ...new Set(
      entries
        .filter((entry) => isServerProducedKey(entry.key))
        // isServerProducedKey already validated the suffix against HASH_PATTERN, so
        // parseHash always succeeds here; the filter satisfies the Hash type and stays
        // defensive if the two ever drift.
        .map((entry) => parseHash(entry.key.slice(CACHE_KEY_PREFIX.length)))
        .filter((hash): hash is Hash => hash !== undefined)
        // D1. Placed inside this pipeline as a SECOND, narrowing filter rather than as an
        // edit to isServerProducedKey or HASH_PATTERN -- those predicates are shared with
        // the server's SRV-03 route and both cleanup branches, their literal count is
        // comment-locked, and `cache-key.ts` is a leaf with no notion of a run (it is also
        // in the action bundle, which this file is not).
        //
        // ITS POSITION RELATIVE TO THE `Set` IS A READABILITY CHOICE, NOT AN INVARIANT, and
        // this clause replaces one that claimed the opposite. `isOtherRunsSeed` is a PURE
        // predicate over the element value and `Set` dedups by value, so
        // `new Set(xs.filter(p))` and `[...new Set(xs)].filter(p)` yield an identical array
        // in identical first-occurrence order. A filtered seed is removed either way and can
        // inflate the distinct-hash count the all-MISS gate reads in neither. Reorder it
        // freely -- for instance to filter on the entry KEY rather than on the parsed hash.
        //
        // IT SHRINKS `scanned`, deliberately, and a reader WILL compare figures across
        // this commit: `scanned` is the denominator of the all-MISS gate below and of
        // every ratio read off the OBS-01 summary. The 149 ubuntu / 150 windows figures
        // recorded before this filter are NOT comparable to the ones after it.
        .filter((hash) => !isOtherRunsSeed(hash, options.runId)),
    ),
  ];

  let mirrored = 0;
  let skipped = 0;
  let failed = 0;
  // Restore-MISS subset of `skipped` (skipped also counts already-present + cap +
  // 422-race). Tracked separately to detect an all-restore-MISS run below, and
  // RETURNED for the OBS-01 summary so the distinction is visible without a log dive
  // -- it is no longer gate-only state.
  let readMisses = 0;
  // Already-present subset of `skipped` (D4), incremented from BOTH membership branches:
  // the pre-restore one at the top of the loop and the post-restore one the first entry of
  // a run still reaches. Every iteration still increments exactly one of mirrored /
  // skipped / failed, so the `scanned` reconciliation is unchanged.
  let alreadyPresent = 0;

  // The shard release + its asset set, resolved lazily (as ONE sentinel: the two
  // were always set together) on the first restorable entry.
  let shard: { id: number; names: Set<string> } | undefined;

  // A SECOND sentinel, and it cannot be folded into `shard`: both states leave `shard`
  // undefined, and the lazy resolve below re-runs on EVERY iteration while it is. So a skip
  // that only returned early would issue one createRelease and one warning PER HASH -- 32 on
  // the measured ubuntu leg, 33 on windows -- which is exactly the noise this file's own
  // fault comment argues against ("isolating it would produce 32 identical warnings -- noise,
  // not signal"). A burned tag name cannot become creatable mid-run, so the second probe
  // could only ever repeat the first answer.
  let burnedShardTag = false;

  // OBS-03: producer attribution as Release METADATA, outside the lookup name, so it
  // survives a namespace change to the name itself. COMMENT-LOCKED, and the lock is the
  // load-bearing half -- what this value means is easy to overstate and the overstatement
  // is worse than no label at all.
  //
  // It names the OS of the PUBLISHING leg -- the leg that ran THIS `publishMirror` and
  // uploaded the bytes. It does NOT name the OS that produced them, and no comment, doc,
  // summary or threat-model line may say otherwise. Two independent reasons:
  //
  // - There is no producing-OS field to read, even if one wanted to. `listCacheEntries`
  //   yields `CacheEntry` = `{ key }` only (see the interface above), and the real adapter
  //   maps every Actions-cache row to `{ key: cache.key }` -- so a producing-OS claim
  //   could only ever be fabricated here, never derived.
  // - Phase 9 is precisely what broke the publisher-equals-producer identity: VER-01 made
  //   the archive path OS-invariant and VER-03 set `enableCrossOsArchive`, so restore is
  //   no longer same-OS. From that phase forward an ubuntu leg CAN restore and mirror a
  //   Windows-produced entry, and would stamp it `linux`. A producing-OS reading would
  //   therefore be WRONG in exactly the cross-OS case the label exists to serve, which is
  //   the worst possible place for an attribution field to lie.
  //
  // Hoisted above the loop so `cachePlatform()` runs ONCE per run rather than once per
  // hash (D-10). Be clear about what that does and does not guarantee: moving it back
  // inside the loop is BEHAVIOURALLY IDENTICAL -- the platform cannot change mid-run -- so
  // the hoist is a readability and cost choice, not a correctness invariant. The only
  // thing protecting it is the multi-hash called-ONCE case in publish-mirror.spec.ts;
  // nothing else in the suite would notice the move. Do not read more protection into it.
  const label = `mirrored-by: ${cachePlatform()}`;

  for (const hash of hashes) {
    const name = releaseAssetName(hash);

    // D3: MEMBERSHIP BEFORE THE RESTORE. The enabling fact is that the asset name is a
    // function of the hash ALONE -- releaseAssetName needs no bytes -- so an entry already
    // in the shard can be skipped without an Actions-cache round-trip. Measured on run
    // 31281406708: 78 of 149 restores per leg were fetched and then discarded by the
    // first-write-wins branch at the bottom of this loop.
    //
    // UNDEFINED-SAFE ON THE SHARD, and that guard is not defensiveness. The shard is
    // resolved LAZILY on the first restorable entry, precisely so an all-MISS leg never
    // creates an empty release, so on early iterations there is no shard to interrogate
    // and an unguarded membership test would throw before the first upload. Do NOT hoist
    // ensureShardRelease above the loop to make this guard simpler: that converts an
    // all-MISS leg into an empty-release creator and re-opens the burned-tag noise case
    // the second sentinel exists to prevent.
    //
    // THREE AGGREGATE OUTCOMES CHANGE, all intended.
    //
    // (1) An oversized-but-already-present asset now returns HERE, before the D-12 size
    // check, so it no longer counts as `failed` -- correct, since nothing is uploaded
    // either way, but it is a different aggregate.
    //
    // (2) The D-11 cap branch below is now reached with a PRESENT name only on the FIRST
    // entry of a run -- the one that resolves the shard, and so the one this guard could
    // not test, because `shard` is still undefined when it runs. Its `!shard.names.has(name)`
    // clause is therefore STILL LOAD-BEARING for exactly that entry; do not delete it as
    // newly-dead. A comment here previously said that branch is now reached only by ABSENT
    // names, which is false in precisely that case: acting on it would make a shard at the
    // cap emit a spurious cap warning for an entry that is already mirrored, and count it
    // as a plain `skipped` rather than an `alreadyPresent`.
    //
    // (3) PUBLISH NO LONGER REFRESHES THE ACTIONS CACHE'S UNACCESSED CLOCK for an entry
    // already in the shard, and that clock is what governs eviction (ci.yml names the
    // 7-day-unaccessed policy). Before this reorder every default-branch push restored
    // EVERY enumerated entry, and a restore is an access, so publish kept every mirrored
    // entry alive indefinitely as a side effect. It no longer does. Accepted: a task hash
    // still in use is fetched by the sidecar on each run and refreshed that way, and an
    // entry already mirrored stays readable from the Release shard through the shard-window
    // walk until retention prunes it. THE ONE CASE WORTH WATCHING is the month-shard
    // rollover -- a hash that evicts from the Actions cache before the month rolls over
    // cannot be re-mirrored into the NEW month's shard, where publish's own restore
    // previously kept it alive.
    //
    // THE RECLASSIFICATION, stated precisely because the obvious overstatement of it is
    // FALSE. An entry that is present in the shard AND would not have restored now counts
    // as an already-present skip instead of a read MISS, which moves `readMisses` down in
    // PARTIAL runs. It does NOT weaken the total-case gate below, and no comment may claim
    // it does: that gate needs `readMisses === hashes.length && mirrored === 0`, while
    // this guard needs a RESOLVED shard, and the shard resolves only after a restore HIT
    // -- which already falsifies the gate's condition. The two are mutually exclusive, so
    // the set of runs on which the gate fires is identical before and after this reorder.
    // In a genuine total rotation window nothing restores, the shard never resolves, this
    // guard never runs, and the gate fires exactly as it does today. Measured on run
    // 31281406708 the reclassification is currently nil in either direction -- zero of the
    // 63 misses were present in the shard.
    if (shard !== undefined && shard.names.has(name)) {
      skipped++;
      alreadyPresent++;

      continue;
    }

    const restored: GetResult = await actionsCache.get(hash);

    if (restored.kind === 'miss') {
      skipped++;
      readMisses++;

      continue;
    }

    const bytes = restored.bytes;

    // D-12: deterministic pre-upload boundary check -- count and skip loud BEFORE any
    // upload, so an oversized artifact is never truncated or dropped (ROBUST-02).
    // core.error is the operator-facing signal; `failed++` + continue keeps the batch
    // running, and the aggregate `failed > 0` check at the end still calls setFailed, so
    // the run is loud and red without discarding the counts a mid-loop throw would lose.
    // Uses strict `>` to match the server's body cap (server.ts handlePut, also `>`)
    // so an entry the primary backend ACCEPTS (exactly RELEASE_ASSET_MAX_BYTES) can
    // never fail the mirror -- the two 2 GiB ceilings are documented to coincide.
    if (bytes.byteLength > RELEASE_ASSET_MAX_BYTES) {
      core.error(
        `github-cache: asset ${name} is ${bytes.byteLength} bytes, over the ~2 GiB Releases ceiling; refusing to upload (never truncate).`,
      );
      failed++;

      continue;
    }

    // The shard's tag name is permanently burned (see ensureShardRelease): every remaining
    // entry is unmirrorable for the same reason, so skip it with NO further API call. The
    // counts stay honest -- `skipped` rises, `mirrored` stays 0, `failed` stays 0 -- so the
    // aggregate setFailed below does not fire and the leg is GREEN by design, with the
    // single warning as the only thing distinguishing it from a healthy run and
    // publish-verify as the downstream red gate.
    if (burnedShardTag) {
      skipped++;

      continue;
    }

    if (shard === undefined) {
      const id = await ensureShardRelease(client, tag);

      if (id === undefined) {
        burnedShardTag = true;
        skipped++;

        continue;
      }

      shard = { id, names: new Set(await client.listReleaseAssets(id)) };
    }

    // D-11: the 1000-asset per-release cap degrades to skip-and-warn, never a hard fail.
    if (shard.names.size >= RELEASE_ASSET_CAP && !shard.names.has(name)) {
      core.warning(
        `github-cache: month-shard release ${tag} is at the ${RELEASE_ASSET_CAP}-asset cap; skipping ${name} (cache MISS-on-write, not an error).`,
      );
      skipped++;

      continue;
    }

    // D-05 first-write-wins: an already-present name is a benign no-op -- no upload,
    // never an overwrite. The SECOND of this file's two byte-identity justifications,
    // and it needs the same corrected reason as the engine doc block above rather than
    // a pointer to it, because this is the branch a reader lands on when they ask "why
    // is skipping safe HERE". No longer byte-identical because the name was
    // OS-namespaced (CORR-02 removed that): byte-identical because the Actions cache
    // holds exactly ONE entry per hash and every leg restores and re-uploads it
    // VERBATIM without re-running the task.
    //
    // STILL REACHABLE AFTER D3, and it is not a leftover. The pre-restore guard at the top
    // of the loop cannot run while `shard` is undefined, so the FIRST entry of a run --
    // the one whose restore resolves the shard -- arrives here having never been tested
    // for membership. This branch is what covers it.
    if (shard.names.has(name)) {
      skipped++;
      alreadyPresent++;

      continue;
    }

    try {
      await client.uploadReleaseAsset(shard.id, name, bytes, label);
      shard.names.add(name);
      mirrored++;
    } catch (error) {
      const reason = faultReason(error);

      // D-05 first-write-wins: a duplicate-upload race (another leg wrote the same
      // byte-identical name between our list and our upload) is a benign no-op -- but
      // ONLY when GitHub says so. `already_exists` is the one 422 this endpoint
      // documents, and the status ALONE does not mean it: GitHub returns 422 from
      // /releases/{id}/assets for several distinct reasons, most of them permanent.
      // Run 30767511870's month shard was created already-PUBLISHED under the repo's
      // immutable-releases setting, so it accepts no assets ever; all 65 uploads (32
      // ubuntu + 33 windows) were rejected 422, a status-only test counted every one as
      // `skipped`, `failed` stayed 0, the aggregate setFailed below never fired, and both
      // legs exited GREEN having mirrored nothing. The failure surfaced one job later in
      // publish-verify, naming the wrong subsystem. An UNREADABLE body is not benign
      // either -- it falls through to the fault branch, because guessing benign is the
      // defect (see `lib/octokit-fault-reason.ts`).
      // SCANNED ACROSS THE WHOLE `errors[]` (see hasFaultCode), never `reason.code`. The
      // benign direction is the dangerous one here: with an order-dependent read, an
      // `already_exists` entry sitting AHEAD of a `custom` immutability rejection makes
      // every rejected upload count as `skipped`, `failed` stays 0, the aggregate setFailed
      // below never fires, and the leg exits GREEN having mirrored nothing -- which is run
      // 30767511870, the run this whole branch was rewritten for. `reason` is still read
      // just below, for the log line, where FIRST-code is the right answer.
      // COUNTED INTO `skipped` ONLY, deliberately never into `alreadyPresent` (D4). The
      // name was absent when this leg listed the shard and another leg wrote it in
      // between: that is a WRITE-race outcome, whereas `alreadyPresent` answers "how much
      // of this enumeration was already done before the leg started". Folding this in
      // would make that number stop answering the one question it exists for.
      if (statusOf(error) === 422 && hasFaultCode(error, 'already_exists')) {
        skipped++;

        continue;
      }

      // A real per-item fault (401/403/429/5xx, and every non-already_exists 422):
      // annotate + count, but isolate it so the rest of the batch still mirrors (D-13).
      // The warning carries GitHub's own reason code AND its own message alongside the
      // asset name and status, so the next occurrence names itself in the job log instead
      // of needing a body dive that the octokit request-log plugin makes impossible (it
      // logs no response body). The message is what makes a `code: custom` policy
      // rejection diagnosable at all -- the code alone says only "read the message".
      // Only the name, the numeric status, that code and GitHub's own message are logged
      // -- never a token, never a raw workflow-command string.
      failed++;
      core.warning(
        `github-cache: failed to mirror ${name} (status ${statusOf(error) ?? 'unknown'}, code ${reason.code ?? 'unknown'}, message ${reason.message ?? 'unknown'}); continuing.`,
      );
    }
  }

  // Silent-degradation signal (WARN, not fail): if EVERY enumerated server-produced
  // entry restored as a MISS and nothing mirrored, the axis is the `@actions/cache`
  // cache VERSION -- the sha256 over (archive paths | compression method |
  // ('windows-only') | salt) at cacheUtils.js:157-172, whose FIRST components are the
  // archive path literals, which is why changing the path rotates the version. That is
  // a SEPARATE mechanism from the Nx TASK hash and from the Release ASSET NAME, each of
  // which produces a superficially similar all-MISS through unrelated machinery -- so
  // the message names the axis rather than saying only "rotation", or a reader
  // misdiagnoses one of the other two (OBS-04, D-30).
  //
  // The alternative cause is an Actions-cache read-scope regression, which looks
  // identical to "nothing to do" and would otherwise exit green. This STAYS a warning:
  // a hard fail would break every legitimate rotation window, and a tripwire that fires
  // on correct work gets disabled (D-28b).
  //
  // The expectation for this milestone's rotation was recorded IN ADVANCE, before the
  // commit that changed the version's input, at
  // `.planning/phases/09-os-invariant-actions-cache-version/09-ROTATION-SIGNAL.md`.
  // Read it before acting on this warning -- it carries the per-leg predicted counts,
  // the non-triggers, and the bundle-drift signal that looks exactly like this one but
  // is a defect.
  //
  // The message's "entr(y|ies)" counts DISTINCT keys, not enumerated rows, since the
  // dedup above -- a strict improvement, but the wording shifted meaning silently,
  // hence this clause.
  if (hashes.length > 0 && readMisses === hashes.length && mirrored === 0) {
    core.warning(
      `github-cache publish: all ${hashes.length} server-produced cache ` +
        `entr${hashes.length === 1 ? 'y' : 'ies'} restored as a MISS; nothing ` +
        'mirrored. The axis here is the @actions/cache cache VERSION -- a SEPARATE ' +
        'mechanism from the Nx TASK hash and from the Release ASSET NAME, each of ' +
        'which produces a look-alike all-MISS through unrelated machinery. Causes ' +
        'worth checking, and this list is not exhaustive: (1) a cache-version ' +
        'rotation in this commit range -- the archive path literal or the cross-OS ' +
        'flag changed; (2) the sidecar that wrote these entries and this publish ' +
        'step running at different versions of this action, which computes two ' +
        "cache versions in one repository; (3) the runtime token's Actions-cache " +
        'read scope. This is expected ONCE per version-affecting change. Two ' +
        'consecutive all-miss pushes with NO version-affecting change in between ' +
        'is the signal to act.',
    );
  } else if (
    readMisses > 0 &&
    wilsonLowerBound(readMisses, hashes.length) >= PARTIAL_READ_MISS_WARN_RATIO
  ) {
    // D5, THE PARTIAL CASE. The gate above fires only on the TOTAL case, which is why it
    // stayed correctly silent while 42% of entries missed for 11 days across two windows.
    // This is a strict ADDITION: a lower-threshold sibling that also subsumes the total
    // case arithmetically, written as an `else if` so exactly ONE of the two can fire and
    // the total case still reaches its own more specific message first.
    //
    // THE RULE IS A LOWER BOUND ON THE MISS PROPORTION, not the proportion itself, and
    // `PARTIAL_READ_MISS_WARN_RATIO` is the TARGET RATE that bound must reach. See
    // `wilsonLowerBound` above for why it is a small-sample regulariser and not a
    // confidence bound. What the regularisation buys is scale invariance: no minimum-N
    // floor, no constant tuned to any one enumeration size, and silence at small N by
    // construction rather than by a second threshold.
    //
    // THE BASELINE IS MEASURED, not estimated. Run `31305961054` at head `e3bf98b`, both
    // publish legs, after D1/D2/D3 landed: 43 misses of 112 enumerated on ubuntu-24.04-arm
    // (38.4%) and 43 of 113 on windows-11-arm (38.1%). The bound at 43/112 is 0.299, so
    // this branch is SILENT at the healthy steady state, and at that enumeration size the
    // observed miss proportion has to reach roughly 60% before it fires. Every figure here
    // carries that run id deliberately: two estimates preceded it and BOTH were wrong, in
    // opposite directions and by the DENOMINATOR each time -- the miss COUNT of 43 was
    // right in both. An unlabelled figure in this comment is how that happened.
    //
    // THE DENOMINATOR IS DELIBERATELY THE FULL ENUMERATION, `hashes.length`, and this is
    // the non-obvious choice a future reader will otherwise "fix" to attempted-only
    // (`scanned - alreadyPresent`), which reads more coherent and is wrong. MEASURED on the
    // same run, attempted-only gives 43/53 = 0.811 on ubuntu and 43/44 = 0.977 on windows,
    // so it would fire on BOTH legs of a healthy run. The cause is structural and
    // permanent: `max-parallel: 1` runs ubuntu first, so the second leg finds nearly
    // everything already present and its attempted-miss rate is dominated by leg ORDER
    // rather than by cache health. The mixed denominator is the one that is stable across
    // leg order.
    //
    // THE GAP AGAINST D5's OWN MOTIVATING CASE, recorded rather than left for review to
    // find. D5 exists because a 42% miss rate went unread for 11 days; at the measured
    // enumeration size this rule does not fire at 42% either, so it still does not cover
    // that case. What covers it is D1 and D2, which removed the accrual that produced it.
    // This branch's job is to catch a future WORSENING from the measured baseline.
    //
    // WHICH BRANCH ACTUALLY FIRES ON A ROTATION, said here because the obvious reading of
    // the pair -- gate above covers the total case, this one covers the partial -- credits
    // the gate above with a cause it cannot trip IN THIS WORKFLOW. `ci.yml` runs the
    // `mirror-seed` step immediately before the `publish` step in the SAME job, so this
    // leg's own `feed<i><run_id>` seed is written in this run, under the current cache
    // version, on the default-branch ref: it is enumerated and it always restores. A
    // cache-VERSION rotation therefore leaves `mirrored >= 1` and the gate above SILENT.
    // Treat this branch as the live rotation signal; the gate above covers only a
    // read-scope regression wide enough to hide the seed itself. A reader tuning the
    // threshold must not over-weight a gate that does not fire.
    //
    // AND IT FIRES ON A VERSION SKEW TOO, not only on a rotation, which is the reading
    // this instruction otherwise sends a reader away from. Where the artifact that WROTE
    // the entries and the artifact this publish step runs from are different versions of
    // this action, the two compute different cache versions in one repository and every
    // enumerated entry misses -- with no rotation anywhere in the commit range to find.
    // Our own instance of that class is action-bundle drift between
    // `start-cache-server/index.js` and the `dist/`-built internal action; the consumer's
    // is a stale pinned ref against a newer install. Same mechanism, same miss shape, and
    // the message names it in the consumer-general form because a stranger cannot act on
    // ours.
    //
    // THE REVISIT TRIGGER HAS ALREADY FIRED ONCE, which is why the figures above are
    // measured: it was "the first live post-fix run on the default branch", and that run is
    // `31305961054`. What remains open is the bare-run-id seed cohort, which D1 cannot
    // filter and which is still inside the 43. As it evicts, the measured baseline falls
    // and the rate can be tightened -- from the next measurement, never from an estimate.
    // Read the observable as `readMisses / scanned` and not as a bare `readMisses`: the
    // count alone is consistent only at one denominator, and `scanned` moves.
    //
    // A WARNING, NEVER A FAILURE: `failed > 0` -> setFailed below is this file's only red
    // signal and it is reserved for per-item upload faults.
    const percent = Math.round((readMisses / hashes.length) * 100);

    // THE MESSAGE IS WRITTEN FOR A STRANGER'S CI LOG, and that is a constraint on its
    // CONTENT, not a matter of tone. It used to close by instructing the reader to compare
    // this figure against a specific later reading of THIS repository rather than an
    // earlier one, on the grounds that the seed filter had moved the denominator between
    // them. A consumer has that filter in no version of their history and has neither
    // reading -- the sentence was our own incident record rendered as a stranger's job
    // log, which `PROJECT.md`'s distribution constraint forbids. The negative assertion in
    // `publish-mirror.spec.ts` is what stops it returning; the phrases it proves absent
    // are split there so they are not planted in the file that proves it.
    //
    // What survives is only what a reader can act on inside their OWN repository: the
    // count, the enumeration size, which denominator that proportion is over, and the
    // causes the sibling gate above already names.
    //
    // AND THE LIST IS NO LONGER CLOSED, which is a separate defect from any one missing
    // item. The retired enumeration asserted a completeness it could not keep: under a
    // version skew it named a rotation the reader never made while naming nothing that
    // occurred. A closed list of three would be wrong again on the next careful reading,
    // so the count is gone and the specifics stayed.
    //
    // ONE TRUE CAUSE LEFT THIS MESSAGE UNNOTICED, recorded here because that is the
    // failure mode a closed list produces. Before `54677af` the closed list named a
    // self-perpetuating cohort: an entry that MISSES is never mirrored, so it is never in
    // the shard, so it is re-enumerated and retried on every future run and can never
    // succeed. That commit removed a sentence leaking this repository's own baselines and
    // realigned the list to the sibling gate's causes, and the cohort went with it. Read
    // that as what the diff shows -- the commit message never mentions dropping a cause,
    // so intent is not established either way.
    //
    // IT IS DELIBERATELY NOT RESTORED AS A NUMBERED CAUSE. "not exhaustive" now covers
    // it, and it is a consequence of any miss rather than an independently actionable
    // diagnosis for a stranger: knowing the cohort perpetuates itself tells the reader
    // nothing to change. So the drop goes on the record without paying the consumer-log
    // cost of a fifth item nobody can act on.
    core.warning(
      `github-cache publish: ${readMisses} of ${hashes.length} server-produced ` +
        `cache entries (${percent}%) restored as a MISS. That is a proportion of ` +
        'the entries ENUMERATED on this leg, not of the restores attempted. Causes ' +
        'worth checking, and this list is not exhaustive: (1) a cache-version ' +
        'rotation in this commit range -- the archive path literal or the cross-OS ' +
        'flag changed; (2) the sidecar that wrote these entries and this publish ' +
        'step running at different versions of this action, which computes two ' +
        "cache versions in one repository; (3) the runtime token's Actions-cache " +
        'read scope; (4) the first publish run against a new month shard, where ' +
        'entries previously skipped as already mirrored are re-attempted and a ' +
        'one-time rise is expected.',
    );
  }

  // OBS-01/D-15: fail the run loud on any aggregate per-item failure, mirroring
  // cleanupMirror. Per-item faults are isolated (D-13) so the batch still completes,
  // but a nonzero total means the mirror is degraded -- a token whose permissions
  // regressed or a sustained upload-phase outage would otherwise count every entry
  // into `failed` yet exit 0, reporting a fully-broken mirror as CI green. Only the
  // count is logged, never a token or a raw workflow-command string.
  if (failed > 0) {
    core.setFailed(`github-cache publish: ${failed} asset mirror(s) failed.`);
  }

  return {
    scanned: hashes.length,
    mirrored,
    skipped,
    readMisses,
    alreadyPresent,
    failed,
  };
}
