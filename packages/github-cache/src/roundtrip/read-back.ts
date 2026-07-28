import * as core from '@actions/core';
import {
  createReleasesReadBackend,
  createReleasesReadClient,
} from '../backend/releases-backend.js';
import { parseHash } from '../lib/cache-key.js';
import { dogfoodBody } from '../lib/dogfood-body.js';
import { isEntrypoint } from '../lib/is-entrypoint.js';
import { CACHE_OS_VALUES } from '../lib/release-asset-name.js';

/**
 * Live cross-OS publish/read-back round-trip (the leg deferred from Phase 3). The
 * per-OS publish matrix mirrored a known nx-cache-<run_id> entry to the current
 * month-shard GitHub Release as <run_id>-<os> (releaseAssetName); this bin resolves
 * it back through the REAL GitHub Releases reader on THIS OS and asserts a HIT WHOSE
 * BYTES equal dogfoodBody(hash, <some known producer>), proving the real publisher writes
 * exactly what the real reader finds -- not merely that some asset resolves.
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
 * Each OS leg resolves ONLY its own-OS asset NAME (a reader on OS A derives
 * <run_id>-<osA>, which only OS A's publish leg uploaded), and the wrong-OS MISS stays
 * unit-proven (releases-backend.spec.ts, spike 005). The asset NAME is same-OS; the
 * PAYLOAD BEHIND IT IS NOT, and that distinction is the whole of 09-08. Since VER-01 +
 * VER-03 made cross-OS restore work, OS A's publish leg may have restored the shared
 * run-scoped seed and mirrored ANOTHER OS's bytes under its own name -- so this bin
 * proves the real publisher/reader round-trip WITHOUT claiming a same-OS producer, and
 * names the producer it observed instead. The full reasoning, the two detections
 * deliberately given up, and the do-not-unify lock sit at the comparison below.
 */
export async function run(): Promise<void> {
  // The publish seed keyed its entry on the workflow run id (the dogfood hash
  // convention: unique per run and already all-decimal, so it satisfies the server's
  // ^[a-f0-9]{1,512}$ validator without massaging).
  const hash = parseHash(process.env.GITHUB_RUN_ID ?? '');

  if (hash === undefined) {
    throw new Error(
      'github-cache round-trip read-back: GITHUB_RUN_ID is required as the hash',
    );
  }

  const backend = createReleasesReadBackend(
    createReleasesReadClient(process.env),
  );
  const result = await backend.get(hash);

  if (result.kind !== 'hit') {
    throw new Error(
      `github-cache round-trip read-back: cache MISS for ${hash} on ${process.platform}. ` +
        'The real Releases reader did not resolve the asset the per-OS publish matrix ' +
        'mirrored this run -- suspect the month-shard tag, the OS asset-name discriminator, ' +
        'or a publish leg that never uploaded.',
    );
  }

  // A HIT alone only proves an asset resolved; assert the BYTES are what the publisher
  // wrote, so a mirrored asset with the wrong contents fails the round-trip instead of
  // passing it. What CHANGED (09-08) is only WHOSE payload counts as "what the publisher
  // wrote": any KNOWN producer's, for THIS hash -- not this reader's own OS.
  //
  // THE PREMISE THIS REPLACES, AND WHAT FALSIFIED IT. This comparison used to derive its
  // ONE expected payload from the READER's own platform (via the ambient platform-mapping
  // helper in release-asset-name.ts), justified by a comment asserting outright that
  // "producer and reader are the same OS by construction". That was true only while the
  // @actions/cache archive version was OS-partitioned. VER-01 (the workspace-relative
  // forward-slash path literal) and VER-03 (enableCrossOsArchive) made cross-OS restore
  // WORK -- the phase's goal -- so a `publish` leg can now restore the run-scoped dogfood
  // key, receive a payload produced on ANOTHER OS, and mirror those bytes under its OWN
  // asset name. MEASURED, not projected: run 30400231720, job
  // `publish-verify (windows-11-arm)`, conclusion failure, on exactly that path.
  //
  // WHAT THIS ASSERTION STILL CATCHES. Acceptance requires EXACT byte equality against
  // one of exactly CACHE_OS_VALUES.length derivable payloads, each of which folds the
  // HASH into its bytes (dogfood-body.ts). So garbage bytes, a partial/truncated upload
  // (Buffer.equals compares length first), an asset for a DIFFERENT hash, a cross-RUN
  // asset-name collision, and a real cache archive resolved by mistake ALL still fail
  // loud. NEVER weaken this to a presence, length or non-empty check: that trades a red
  // job for a silently-passing one, which is strictly worse than the red it removes.
  // read-back.spec.ts's rejection group is the test-enforced half of that rule.
  //
  // WHAT IT DELIBERATELY NO LONGER CATCHES -- BOTH losses, owned by ROADMAP Phase 10
  // item 3 / OBS-05 (each publish leg seeding a leg-DISTINGUISHABLE hash):
  //   1. A Windows publish path that is entirely DEAD, because the ubuntu-produced
  //      payload it mirrors is now accepted.
  //   2. An OS-discriminator collapse WITHIN a single run -- a CORR-01 regression in
  //      releaseAssetName -- because a Windows reader resolving the ubuntu leg's asset
  //      now passes.
  // Loss 2 is the one a reader will challenge, so: under today's SHARED run-scoped seed
  // key that signal is INSEPARABLE from the false alarm being fixed. Both legs mirror the
  // same payload, so the old guard's Windows failure IS the collapse signal AND IS the
  // false alarm -- one cannot be kept without the other. It stays unit-pinned elsewhere:
  // release-asset-name.spec.ts pins the exact produced name, and releases-backend.spec.ts
  // carries CORR-01's documented non-vacuity proof. Cross-RUN collision IS still caught
  // (the hash differs), so the failure message's surviving hypothesis is accurate as
  // written -- do not widen it to imply otherwise. Once OBS-05 lands the producer is
  // knowable per leg again and this scan can tighten back to an exact expectation; the
  // producer named in the success line below is what a Phase 10 executor reads to confirm
  // that tightening is correct.
  //
  // DO NOT UNIFY THIS GUARD WITH dogfood-verify's -- IN EITHER DIRECTION. The
  // `dogfood-verify` branch in action/index.ts asserts a HARD-CODED single producer
  // (its `expectedProducerOs`) and is CORRECT to: the `dogfood-seed` job is single-leg
  // ubuntu BY DESIGN, pinned by dogfood-cross-os.spec.ts's no-matrix clause, so its
  // producer is known by construction. This bin reads a MIRRORED asset and `publish` is
  // a TWO-leg matrix sharing ONE run-scoped seed key, so its producer is genuinely
  // VARIABLE. Unifying DOWNWARD (asserting one producer here) reintroduces this exact
  // regression the first time the ubuntu leg loses the `max-parallel: 1` race -- and
  // reddens two of the three provenance cases in read-back.spec.ts. Unifying UPWARD
  // (letting dogfood-verify accept any producer) destroys VER-06's provenance proof, the
  // phase's headline live closure. The asymmetry is intentional and load-bearing.
  //
  // A SAME-OS-INVARIANT SWEEP MUST ENUMERATE CODE PATHS, NOT ONLY PROSE. DOCS-08
  // enumerated four DOCUMENTATION sites asserting same-OS restore. This was a FIFTH
  // site, in EXECUTABLE LOGIC, sitting in a `//` comment directly above the comparison it
  // justified, and no requirement among this milestone's eleven owned it. That is why the
  // regression shipped.
  //
  // THE REMAINING HALF IS `ci.yml`'s `publish-verify` JOB COMMENT, AND PHASE 10 OWNS IT.
  // 09-CONTEXT.md's deferred list paired this bin's same-OS claims with that job comment
  // and routed BOTH to Phase 10 (TRUST-11 / OBS-05). Plan 09-08 OVERRIDES the read-back.ts
  // half in Phase 9, on the maintainer's routing decision after the failure was measured
  // (09-EVIDENCE.md's addendum). It does NOT touch ci.yml. So the `publish-verify` job
  // comment still says each OS leg reads back ONLY its own-OS asset and that this proves
  // the same-OS publisher-to-reader contract -- FLATLY FALSE about what this code now
  // asserts, and the same stale-prose class. TRUST-11 must NOT be closed on the strength
  // of read-back.ts having already changed. Named by JOB, not by line: this phase measured
  // ci.yml drifting ~220 lines inside one milestone.
  const producerOs = CACHE_OS_VALUES.find((os) =>
    result.bytes.equals(dogfoodBody(hash, os)),
  );

  if (producerOs === undefined) {
    throw new Error(
      `github-cache round-trip read-back: cache HIT for ${hash} on ${process.platform} ` +
        'but the returned bytes match NO known producer OS -- tried ' +
        `${CACHE_OS_VALUES.join(', ')}. So they are not what any of our publishers ` +
        'wrote for this hash: suspect a partial upload, an asset-name discriminator ' +
        'colliding across runs, or an asset for a different hash.',
    );
  }

  core.info(
    `github-cache round-trip read-back: cache HIT for ${hash} on ${process.platform} ` +
      `with bytes matching a '${producerOs}'-produced payload; the real publisher/reader ` +
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
