import * as core from '@actions/core';
import {
  createReleasesReadBackend,
  createReleasesReadClient,
} from '../backend/releases-backend.js';
import { parseHash } from '../lib/cache-key.js';
import { dogfoodBody } from '../lib/dogfood-body.js';
import { isEntrypoint } from '../lib/is-entrypoint.js';
import { mirrorSeedHash } from '../lib/mirror-seed.js';
import { cachePlatform } from '../lib/release-asset-name.js';

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
  //      nobody else writes nx-cache-<this leg's seed>, so a dead leg surfaces as a MISS.
  //      RESIDUAL, AND STILL OPEN AT THIS COMMIT: that MISS only follows if no OTHER leg
  //      mirrors this key first, which depends on the legs not overlapping in time. WHO
  //      uploaded the asset is a different question from WHICH key it sits under, and
  //      nothing here answers the first one yet.
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

  core.info(
    `github-cache round-trip read-back: cache HIT for ${hash} on ${readerOs} with bytes ` +
      `matching the '${readerOs}'-produced payload this leg seeded; the real ` +
      'publisher/reader round-trip is closed.',
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
