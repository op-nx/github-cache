import * as core from '@actions/core';
import { createActionsCacheBackend } from '../backend/actions-cache-backend.js';
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
   * versions counts once). The denominator the other counts are read against.
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
  readonly failed: number;
}

/** Test-injection knobs only (no runtime mode surface). `now` pins the shard tag. */
export interface PublishOptions {
  readonly now?: Date;
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
 * Returns the scanned/mirrored/skipped/readMisses/failed counts; the bin emits the
 * OBS-01 summary from them.
 */
export async function publishMirror(
  client: PublishClient,
  options: PublishOptions = {},
): Promise<PublishResult> {
  const tag = shardTag(options.now);
  const actionsCache = createActionsCacheBackend();

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
        .filter((hash): hash is Hash => hash !== undefined),
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
    const restored: GetResult = await actionsCache.get(hash);

    if (restored.kind === 'miss') {
      skipped++;
      readMisses++;

      continue;
    }

    const bytes = restored.bytes;
    const name = releaseAssetName(hash);

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
    if (shard.names.has(name)) {
      skipped++;

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
        'which produces a look-alike all-MISS through unrelated machinery. Two ' +
        'candidate causes: (1) a cache-version rotation in this commit range -- the ' +
        'archive path literal or the cross-OS flag changed; (2) the runtime ' +
        "token's Actions-cache read scope. This is expected ONCE per " +
        'version-affecting change. Two consecutive all-miss pushes with NO ' +
        'version-affecting change in between is the signal to act.',
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

  return { scanned: hashes.length, mirrored, skipped, readMisses, failed };
}
