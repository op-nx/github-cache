import * as core from '@actions/core';
import {
  createReleasesReadBackend,
  createReleasesReadClient,
} from '../backend/releases-backend.js';
import { parseHash, type Hash } from '../lib/cache-key.js';
import { dogfoodBody } from '../lib/dogfood-body.js';
import { isEntrypoint } from '../lib/is-entrypoint.js';
import {
  resolveLocalReadToken,
  resolveRepoIdentity,
} from '../lib/local-context.js';
import { mirrorSeedHash } from '../lib/mirror-seed.js';
import {
  cachePlatform,
  releaseAssetName,
  type CacheOs,
} from '../lib/release-asset-name.js';
import { shardTag } from '../lib/retention.js';

/**
 * GitHub REST API origin, page size and request bound for the publisher-label read. All
 * three are authored HERE rather than imported from releases-backend.ts, and that is
 * deliberate: that module is inside the `serve()` bundle, so exporting anything from it to
 * reach this bin would widen the consumer read seam and take on a ROBUST-04 rebuild for a
 * concern no consumer has (T-10-09). This bin is on the zero-dependency native-fetch path
 * and is provably absent from the committed bundle, so the copies cost nothing there.
 */
const GITHUB_API = 'https://api.github.com';
const FETCH_TIMEOUT_MS = 5000;
const ASSETS_PER_PAGE = 100;

/**
 * The publisher-label prefix. The OTHER home for this literal is publish-mirror.ts's
 * upload, which STAMPS it -- so the writer and this reader must agree, and the pinned-
 * literal discipline (dogfood-body.ts's template, pinned in two files by design) is what
 * this follows rather than a shared constant. Considered and rejected: a lib leaf owning
 * the label. Extracting one would touch publish-mirror.ts, which sits in the publish graph
 * a ROBUST-04 rebuild already covers, to remove a drift whose failure mode is a LOUD
 * publish-verify RED naming both values -- not the silent MISS that justifies single-
 * sourcing the asset NAME. A guard that fails loudly does not need a second mechanism.
 */
const MIRRORED_BY_PREFIX = 'mirrored-by: ';

/**
 * Assert the shard asset this leg just read back was uploaded by THIS leg's own publish
 * path, by reading the `mirrored-by` label OBS-03 stamps at upload time.
 *
 * THIS IS THE ONLY MECHANISM THAT DETECTS A DEAD PUBLISH LEG. The byte comparison in run()
 * cannot, and a reader will assume otherwise unless it is written down: the bytes of this
 * leg's seed asset are the payload dogfoodBody(seed, thisLegsOs) regardless of which leg
 * UPLOADED them, because the SEED was written by this leg. Provenance-of-payload and
 * provenance-of-publisher are DIFFERENT AXES and only the label carries the second. The
 * concrete failure it catches: this leg's publish path is entirely DEAD, the OTHER leg's
 * enumeration saw this leg's seed key, restored it (cross-OS restore works since VER-01 +
 * VER-03) and uploaded it under this leg's own asset name. Every other assertion in this
 * bin passes. The label reads the other leg's OS.
 *
 * WHAT THIS ASSERTION REMOVED: A DEPENDENCY ON UNDOCUMENTED GITHUB SCHEDULING. Before it,
 * detection rested on the legs starting in a particular ORDER. Each leg takes ONE
 * listCacheEntries() snapshot before its loop, so the leg that runs LAST is the only leg
 * whose dead publish path is detectable -- the second leg's snapshot necessarily post-dates
 * the first leg's seed and therefore covers for it. OBS-05 names windows, and windows
 * MEASURABLY runs last: 5/5 of the default-branch push runs on record, with 150-190 second
 * margins (run 30401077417 -- `publish (ubuntu-24.04-arm)` step 7 ends 2026-07-28T21:33:39Z,
 * `publish (windows-11-arm)` step 6 starts 21:36:32Z). A MEASUREMENT IS NOT A DOCUMENTED
 * GUARANTEE, and both halves belong in the record: GitHub documents matrix CREATION order
 * only, names runner AVAILABILITY as a scheduling input, and the two legs draw from
 * DIFFERENT hosted pools (ubuntu-24.04-arm vs windows-11-arm), so per-leg availability is a
 * genuinely independent variable. Reverse the order and windows silently becomes the
 * undetectable leg.
 *
 * WHAT IT DEPENDS ON INSTEAD: NON-OVERLAP, NOT ORDER. If ci.yml's `publish` JOB (located by
 * job name -- this phase measured ci.yml drifting ~220 lines inside one milestone) lost
 * `max-parallel: 1` and the legs ran concurrently, the other leg could win the upload race
 * for this leg's seed asset while this leg's own upload 422s into the benign `skipped`
 * branch, and this assertion would go RED on a CORRECT implementation. Non-overlap is
 * exactly what `max-parallel: 1`'s own comment already documents that knob as existing for,
 * whereas start ORDER is a property GitHub does not document at all -- so the trade is an
 * undocumented external guarantee for a documented in-repo one, a strict improvement rather
 * than a lateral move.
 *
 * THAT COUPLING IS GUARD SENSITIVITY, NOT A WRONG-RESULT GUARANTEE, and conflating the two
 * would breach XOS-06. Removing `max-parallel: 1` costs a CI guard its sensitivity; it
 * cannot make a wrong artifact reachable by any developer, because both legs upload bytes
 * restored verbatim from the SAME single Actions-cache entry (TRUST-11) and correctness of
 * a served artifact rests on CORR-05's platform-agnosticism. The distinction is stated in
 * BOTH places on purpose -- here and at `max-parallel: 1` itself -- so neither comment
 * reads as contradicting the other.
 *
 * ReleaseReadClient is deliberately NOT widened to carry the label. That seam is inside the
 * `serve()` bundle, so widening it would trigger a ROBUST-04 rebuild and put an attribution
 * concern into the consumer read path for no consumer benefit. A direct native fetch here
 * costs one function and zero blast radius.
 */
async function assertPublishedByThisLeg(
  hash: Hash,
  readerOs: CacheOs,
): Promise<void> {
  const token = await resolveLocalReadToken(process.env);
  const repo = await resolveRepoIdentity(process.env);

  if (token === undefined || repo === undefined) {
    // The consumer reader degrades an unresolved credential to a MISS by design. This bin
    // must NOT: a provenance assertion that silently no-ops when a token is absent is
    // precisely the vacuity it exists to close, and publish-verify would report green
    // having checked nothing.
    throw new Error(
      'github-cache round-trip read-back: cannot read the publisher label -- no token ' +
        '(GH_TOKEN/GITHUB_TOKEN) or no repo identity (GITHUB_REPOSITORY, else the origin ' +
        'remote) resolved. Skipping the check is not an option: it is the whole assertion.',
    );
  }

  const tag = shardTag();
  const headers = {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  };
  const releaseResponse = await fetch(
    `${GITHUB_API}/repos/${repo}/releases/tags/${tag}`,
    { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
  );

  assertResponseOk(releaseResponse, `release lookup for shard ${tag}`);

  const release = (await releaseResponse.json()) as { id: number };
  const assetName = releaseAssetName(hash);
  let asset: { label: string | null } | undefined;

  // PAGINATE, and do NOT read the release payload's inline `assets` array. That snapshot is
  // a non-paginated FIRST PAGE -- the publisher's own recorded Pitfall 4, which is why
  // createPublishClient.listReleaseAssets paginates too -- and the live cache-mirror-202607
  // shard already holds 122 assets, so this leg's seed asset can legitimately sit beyond
  // page one. A single-page read would therefore redden publish-verify on a CORRECT
  // implementation, and a guard that fails on correct work gets disabled (OBS-04's lesson).
  // RESEARCH's recommendation named the tags endpoint without naming the cap; this is that
  // correction. Increment until a SHORT page, matching the reader's own walk.
  for (let page = 1; asset === undefined; page++) {
    const listResponse = await fetch(
      `${GITHUB_API}/repos/${repo}/releases/${release.id}/assets?per_page=${ASSETS_PER_PAGE}&page=${page}`,
      { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );

    assertResponseOk(listResponse, `asset list page ${page} of shard ${tag}`);

    const batch = (await listResponse.json()) as {
      name: string;
      label: string | null;
    }[];

    asset = batch.find((candidate) => candidate.name === assetName);

    if (batch.length < ASSETS_PER_PAGE) {
      break;
    }
  }

  if (asset === undefined) {
    throw new Error(
      `github-cache round-trip read-back: shard ${tag} holds no asset named ${assetName} ` +
        'after every page was walked, yet the reader resolved a HIT for it. Suspect a ' +
        'month-boundary shard walk (the reader tries older shards, this check reads only ' +
        'the current one) or an asset deleted between the two reads.',
    );
  }

  const expected = `${MIRRORED_BY_PREFIX}${readerOs}`;

  // ONE comparison covers all three rejection classes -- a different publisher, an EMPTY
  // label, and a null one. The empty case is not hypothetical: all 122 assets in the live
  // shard carry an empty label because every one predates OBS-03, so an empty label reading
  // as a pass would make this guard vacuous against the real data rather than against some
  // edge case.
  if (asset.label !== expected) {
    throw new Error(
      `github-cache round-trip read-back: ${assetName} in shard ${tag} reports publisher ` +
        `'${asset.label ?? '<null>'}' but this leg expected publisher '${expected}'. The ` +
        'label names the leg that UPLOADED the asset, so a mismatch means THIS leg never ' +
        'published its own seed and another leg covered for it -- a DEAD publish path. An ' +
        'empty label instead means a pre-OBS-03 upload with no publisher stamped.',
    );
  }
}

/**
 * Fail loud on any non-ok response from the label read. Discrimination is STRUCTURAL on
 * res.status only, never body text (the D-11 discipline copied from releases-backend.ts).
 *
 * What is deliberately NOT copied is that module's 404-versus-fault SPLIT. It exists there
 * because the reader has TWO outcomes -- a 404 means try the next shard, anything else is a
 * fault -- while this bin has already observed a HIT and so has exactly ONE outcome for
 * every non-ok status: fail. The status is named in the message, which is what an operator
 * needs to tell an absent shard (404) from a rate limit (403); a second branch would add a
 * code path with no distinct behaviour behind it.
 */
function assertResponseOk(response: Response, what: string): void {
  if (response.ok) {
    return;
  }

  throw new Error(
    `github-cache round-trip read-back: ${what} failed with status ${response.status}. ` +
      'A 404 means the shard or the listing is gone; anything else is a transport or ' +
      'permission fault. Either way the publisher label could not be read, and this check ' +
      'fails rather than passing unverified.',
  );
}

/**
 * Live cross-OS publish/read-back round-trip (the leg deferred from Phase 3). Each leg of
 * the per-OS publish matrix seeds an Actions-cache entry under a key only THAT leg can
 * produce -- mirrorSeedHash(GITHUB_RUN_ID, cachePlatform()) -- and mirrors it to the
 * current month-shard GitHub Release under releaseAssetName(mirrorSeedHash(...)). This bin
 * resolves that same derived seed back through the REAL GitHub Releases reader on THIS OS
 * and asserts the returned bytes equal dogfoodBody(<its own derived seed>, <its own OS>)
 * exactly, proving the real publisher writes what the real reader finds -- not merely that
 * some asset resolves.
 *
 * The wording above is deliberate, and docs-same-os-claims.spec.ts's retraction scan is
 * what enforces it: OBS-03 retracts any phrasing that reads as the mirror ANSWERING which
 * producer's bytes a reader received. This bin knows its producer from its own key, which
 * is a narrower fact than the mirror reporting one, so it is stated as a byte comparison
 * rather than as an attribution.
 *
 * The asset name is described THROUGH releaseAssetName rather than as a literal template
 * on purpose: CORR-02 collapses the OS suffix out of that name, and the sentence above
 * stays true across the rename because it names the helper instead of its current output.
 *
 * It invokes the reader DIRECTLY -- createReleasesReadBackend(createReleasesReadClient
 * (process.env)) -- NOT selectBackend, which in a push (write-trusted) context returns
 * the writable Actions-cache backend, not the Releases reader (TRUST-05). The reader is
 * on the zero-dep native-fetch path and needs NO ACTIONS_RUNTIME_TOKEN, so this runs as
 * a plain `node` step, unlike the publish/seed operations which need the JS-action
 * runtime. GITHUB_TOKEN/GH_TOKEN + GITHUB_REPOSITORY in the env let resolveLocalReadToken
 * (tier 1) and resolveRepoIdentity resolve. The reader walks shardTagsForWindow
 * newest-first (04-02), so the same-run current-month asset is resolved. The reader
 * swallows every fault into a MISS by design, so a MISS here -- for any reason -- fails
 * the round-trip loud (non-zero exit): the round-trip's contract is a HIT.
 *
 * Each OS leg resolves ONLY the asset its OWN publish leg uploaded, and the reason is a
 * per-leg SEED DERIVATION -- NOT a per-leg asset NAME. That distinction is the whole of
 * OBS-05 and it is what makes this bin survive CORR-02: the old justification was that a
 * reader on OS A derived an asset name carrying `-osA`, which only OS A's publish leg had
 * written. Collapsing the OS out of the name (CORR-02) destroys that argument completely
 * -- every leg would derive the SAME name. What replaces it is the KEY: the seed itself
 * folds the leg's OS in, so a windows reader looks up a hash no other leg ever wrote,
 * whatever the name derived from it happens to look like. This is why OBS-05 must land
 * BEFORE the rename rather than alongside it.
 *
 * The PAYLOAD behind that asset is a separate axis from the NAME, and 09-08 is the record
 * of confusing them. Since VER-01 + VER-03 made cross-OS restore work, a publish leg can
 * restore an entry produced on another OS and mirror those bytes under its own name -- so
 * for a SHARED seed key the producer was unknowable. A per-leg seed removes the sharing:
 * only this leg seeded this key, so the producer is knowable by construction again. The
 * full reasoning, what the tightening restored, and the do-not-unify lock sit at the
 * comparison below.
 */

export async function run(): Promise<void> {
  // ONE binding for this leg's OS, read once. Both the seed derivation and the payload
  // expectation must name the SAME leg, and a single binding is what makes that one fact
  // rather than two reads that could drift. Mirrors the mirror-seed branch in
  // action/index.ts, which binds cachePlatform() once for the same reason.
  const readerOs = cachePlatform();
  const runId = process.env.GITHUB_RUN_ID ?? '';

  // TWO GUARDS, TWO DIAGNOSES, and the split is load-bearing rather than tidy. An absent
  // GITHUB_RUN_ID no longer reaches the hash validator as an empty string: mirrorSeedHash
  // prepends a marker, so an empty run id derives `feed<index>` -- valid lowercase hex,
  // which parseHash ACCEPTS. Folding these two checks back together would let a missing
  // run id sail through and look up the seed of the empty run, and the symptom would read
  // as a dead publish path rather than as an unset variable.
  if (runId === '') {
    throw new Error(
      'github-cache round-trip read-back: GITHUB_RUN_ID is required as the seed input',
    );
  }

  const hash = parseHash(mirrorSeedHash(runId, readerOs));

  if (hash === undefined) {
    throw new Error(
      `github-cache round-trip read-back: the seed derived from GITHUB_RUN_ID '${runId}' ` +
        `on this ${readerOs} leg is not a valid cache hash. mirrorSeedHash keeps the ` +
        'marker and the OS index inside the hex charset, so this means the run id itself ' +
        'carried something outside ^[a-f0-9]+$.',
    );
  }

  const backend = createReleasesReadBackend(
    createReleasesReadClient(process.env),
  );
  const result = await backend.get(hash);

  if (result.kind !== 'hit') {
    throw new Error(
      `github-cache round-trip read-back: cache MISS for ${hash} on ${readerOs}. ` +
        'The real Releases reader did not resolve the asset this leg mirrored this run -- ' +
        'suspect the month-shard tag, a drift between the two mirrorSeedHash call sites ' +
        '(the mirror-seed operation writes the key, this bin derives it again), or a ' +
        'publish leg that never uploaded.',
    );
  }

  // A HIT alone only proves an asset resolved; assert the BYTES are what the publisher
  // wrote, so a mirrored asset with the wrong contents fails the round-trip instead of
  // passing it.
  //
  // THIS IS EXACT AGAIN, AND THAT IS THE POINT (OBS-05 / D-15). Plan 09-08 RELAXED this
  // to a scan across every known producer, because both publish legs seeded ONE
  // run-scoped key and the producer was therefore genuinely unknowable. OBS-05 removes
  // the sharing: this leg's seed is derived from this leg's OS, only this leg could have
  // written it, so exactly ONE payload is correct. The reader now accepts one of
  // CACHE_OS_VALUES.length candidates rather than any of them, and read-back.spec.ts's
  // cross-producer matrix is the test-enforced half of that -- every pair in it was
  // ACCEPTED under the old scan.
  //
  // WHAT THIS ASSERTION CATCHES. Acceptance requires EXACT byte equality against ONE
  // derivable payload which folds the HASH into its bytes (dogfood-body.ts). So garbage
  // bytes, a partial/truncated upload (Buffer.equals compares length first), an asset for
  // a DIFFERENT hash, a cross-RUN asset-name collision, and a real cache archive resolved
  // by mistake ALL still fail loud. NEVER weaken this to a presence, length or non-empty
  // check: that trades a red job for a silently-passing one, which is strictly worse than
  // the red it removes.
  //
  // THE TWO DETECTIONS 09-08 GAVE UP ARE BOTH RESTORED, and by the SAME mechanism -- the
  // per-leg seed key, not the tightening on its own:
  //   1. A publish path that is entirely DEAD. Under a shared key, a dead windows leg was
  //      covered for by the ubuntu leg's upload of that same key. Under per-leg seeds
  //      nobody else writes nx-cache-<this leg's seed>, so a dead leg surfaces as a MISS --
  //      but ONLY if no other leg mirrored this key first, which under the measured
  //      ordering is exactly what the covering leg does. WHO uploaded the asset is a
  //      different question from WHICH key it sits under, so the seed alone does not close
  //      this: assertPublishedByThisLeg above does, by reading the `mirrored-by` label.
  //      That is where the ordering-versus-non-overlap reasoning lives; do not duplicate
  //      it here.
  //   2. An OS-discriminator collapse WITHIN a single run. This is the one a reader
  //      challenges, so state it exactly: the detection is restored, and restored in the
  //      one form that SURVIVES CORR-02. A windows reader can no longer resolve the ubuntu
  //      leg's asset -- not because the NAME differs (CORR-02 makes the names identical)
  //      but because the KEY does. Cross-RUN collision was never lost (the hash differs).
  //
  // DO NOT UNIFY THIS GUARD WITH dogfood-verify's -- IN EITHER DIRECTION. Both guards now
  // assert exactly ONE producer, so the old asymmetry argument ("dogfood-verify's producer
  // is fixed, this bin's is genuinely VARIABLE") no longer holds and has been rewritten
  // rather than left standing -- stale prose justifying a live lock is precisely the class
  // that shipped the Phase 9 regression. The lock's CONCLUSION is unchanged, and here is
  // the surviving reason: the two producers are fixed by DIFFERENT FACTS with different
  // failure modes. dogfood-verify's producer is fixed by a single-leg JOB -- dogfood-seed
  // is ubuntu-only BY DESIGN, pinned by dogfood-cross-os.spec.ts's no-matrix clause -- so
  // its hard-coded expectedProducerOs is correct exactly while that job stays single-leg.
  // This bin's producer is fixed by a per-leg SEED DERIVATION over a TWO-leg matrix, so
  // its expectation must be DERIVED per leg and is correct exactly while both call sites
  // of mirrorSeedHash agree. Unifying either way would let a change to one fact silently
  // satisfy the other guard: adding a matrix to dogfood-seed would go undetected by a
  // derived expectation, and hard-coding one here would go undetected by a single-leg job.
  // The asymmetry is intentional and load-bearing.
  //
  // A SAME-OS-INVARIANT SWEEP MUST ENUMERATE CODE PATHS, NOT ONLY PROSE. DOCS-08
  // enumerated four DOCUMENTATION sites asserting same-OS restore. This was a FIFTH
  // site, in EXECUTABLE LOGIC, sitting in a `//` comment directly above the comparison it
  // justified, and no requirement among that milestone's eleven owned it. That is why the
  // regression shipped.
  //
  // THE REMAINING HALF IS `ci.yml`'s `publish-verify` JOB COMMENT, AND THIS PLAN OWNS IT.
  // 09-CONTEXT.md deferred that half to Phase 10 (D-21) and plan 09-08 flagged it here by
  // JOB NAME. AT THIS COMMIT it still says each OS leg reads back ONLY its own-OS asset
  // and that this proves the same-OS publisher-to-reader contract -- the first half is
  // true again for a DIFFERENT reason (the seed, not the name) and the second half is
  // FLATLY FALSE. The warning stands and is the reusable half: TRUST-11 must NOT be closed
  // on the strength of read-back.ts having already changed. Named by JOB, not by line:
  // this phase measured ci.yml drifting ~220 lines inside one milestone.
  if (!result.bytes.equals(dogfoodBody(hash, readerOs))) {
    throw new Error(
      `github-cache round-trip read-back: cache HIT for ${hash} on ${readerOs} but the ` +
        `returned bytes are NOT the ${readerOs}-produced payload this leg's own publish ` +
        'path seeded. Only this leg can write this key, so the bytes should be its own: ' +
        'suspect a partial upload, an asset for a different hash, or a cross-run ' +
        'asset-name collision.',
    );
  }

  await assertPublishedByThisLeg(hash, readerOs);

  core.info(
    `github-cache round-trip read-back: cache HIT for ${hash} on ${readerOs} with bytes ` +
      `matching the '${readerOs}'-produced payload this leg seeded, published by this same ` +
      `leg (label '${MIRRORED_BY_PREFIX}${readerOs}'); the real publisher/reader ` +
      'round-trip is closed.',
  );
}

// Direct-invocation guard: run() only when this module is the entrypoint (the built
// dist/roundtrip/read-back.js invoked by ci.yml's publish-verify job), never when
// imported. isEntrypoint owns the Windows Pitfall-6 idiom. A whole-run fault reaches
// core.setFailed (non-zero exit) so the round-trip fails loud (OBS-01/D-15).
//
// run() is EXPORTED so the co-located read-back.spec.ts can drive it directly, matching
// cleanup/index.ts and action/index.ts -- both bins export run() behind this same guard
// and are driven by their own spec. This guard is what makes the import inert, so
// exporting costs nothing at runtime. It is an internal module export, NOT a barrel
// export: the DOCS-05 consumer surface is unchanged.
if (isEntrypoint(import.meta.url)) {
  run().catch((error: unknown) => {
    core.setFailed(error instanceof Error ? error.message : String(error));
  });
}
