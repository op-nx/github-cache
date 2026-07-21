import { pathToFileURL } from 'node:url';
import * as core from '@actions/core';
import {
  createReleasesReadBackend,
  createReleasesReadClient,
} from '../backend/releases-backend.js';
import { parseHash } from '../lib/cache-key.js';

/**
 * Live cross-OS publish/read-back round-trip (the leg deferred from Phase 3). The
 * per-OS publish matrix mirrored a known nx-cache-<run_id> entry to the current
 * month-shard GitHub Release as <run_id>-<os> (releaseAssetName); this bin resolves
 * it back through the REAL GitHub Releases reader on THIS OS and asserts a HIT,
 * proving the real publisher writes exactly what the real reader finds.
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
 * Each OS leg resolves ONLY its own-OS asset (a reader on OS A derives <run_id>-<osA>,
 * which only OS A's publish leg wrote), so this proves the same-OS publish->reader
 * contract live; the wrong-OS MISS is unit-proven (releases-backend.spec.ts, spike 005).
 */
async function run(): Promise<void> {
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

  core.info(
    `github-cache round-trip read-back: cache HIT for ${hash} on ${process.platform}; ` +
      'the real publisher/reader round-trip is closed.',
  );
}

// Direct-invocation guard: run() only when this module is the entrypoint (the built
// dist/roundtrip/read-back.js invoked by ci.yml's publish-verify job), never when
// imported. Use pathToFileURL(process.argv[1]).href -- the naive 'file://' + argv[1]
// form is permanently false on Windows (Pitfall 6). A whole-run fault reaches
// core.setFailed (non-zero exit) so the round-trip fails loud (OBS-01/D-15).
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run().catch((error: unknown) => {
    core.setFailed(error instanceof Error ? error.message : String(error));
  });
}
