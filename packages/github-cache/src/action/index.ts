import * as core from '@actions/core';
import type { Octokit } from '@octokit/rest';
import { serve } from '../serve.js';
import { isEntrypoint } from '../lib/is-entrypoint.js';
import { isSyncTrusted } from '../lib/sync-gate.js';
import { createResilientOctokit } from '../lib/resilient-octokit.js';
import { dogfoodBody } from '../lib/dogfood-body.js';
import { mirrorSeedHash } from '../lib/mirror-seed.js';
import { cachePlatform } from '../lib/release-asset-name.js';
import { writeCountSummary } from '../lib/summary.js';
// The ONLY import site of compression-method.js in the repo, and it must stay that
// way (D-17). The committed sidecar bundle has a single entry,
// start-cache-server/entry.ts, which does not reach this module -- so importing the
// probe from runPublish keeps a child-process spawn out of the bundle every consumer
// resolves via `uses:`, and out of ROBUST-04's rebuild obligation. `npm run
// check:action` returning an EMPTY diff is what proves it stayed out.
import { resolveCompressionMethod } from '../lib/compression-method.js';
import {
  GITHUB_REPOSITORY_PATTERN,
  resolveGitHubToken,
} from '../lib/github-identity.js';
import {
  publishMirror,
  type PublishClient,
} from '../publish/publish-mirror.js';

/**
 * The real PublishClient adapter over @octokit/rest (D-04), mirroring the cleanup
 * bin's createCleanupClient. The two list methods go through `octokit.paginate`
 * (materialize-all, reject-on-page-fault). listCacheEntries scopes to THIS ref (the
 * default branch) and drops the rare keyless cache row so the engine only ever sees a
 * concrete key. listReleaseAssets paginates the assets endpoint -- NEVER the inline
 * release.assets first-page snapshot (Pitfall 4) -- and maps to asset NAMES, which is
 * all the engine compares for first-write-wins (D-05). getReleaseByTag throws a 404
 * when the shard is absent; createRelease throws a 422 when another matrix leg created
 * the tag first -- ensureShardRelease inside the engine handles both. The engine
 * imports NO @octokit/rest; octokit lives here in the bin/action.
 */
export function createPublishClient(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string,
): PublishClient {
  return {
    async listCacheEntries() {
      // getActionsCacheList needs the job's actions:read scope (Pitfall 3). Scope to
      // this ref (refs/heads/<default-branch>) so only default-branch entries mirror.
      const caches = await octokit.paginate(
        octokit.rest.actions.getActionsCacheList,
        { owner, repo, ref, per_page: 100 },
      );

      return caches
        .filter((cache): cache is typeof cache & { key: string } => {
          return typeof cache.key === 'string';
        })
        .map((cache) => ({ key: cache.key }));
    },

    async getReleaseByTag(tag) {
      const { data } = await octokit.rest.repos.getReleaseByTag({
        owner,
        repo,
        tag,
      });

      return data;
    },

    async createRelease(tag) {
      const { data } = await octokit.rest.repos.createRelease({
        owner,
        repo,
        tag_name: tag,
      });

      return data;
    },

    async listReleaseAssets(releaseId) {
      const assets = await octokit.paginate(
        octokit.rest.repos.listReleaseAssets,
        { owner, repo, release_id: releaseId, per_page: 100 },
      );

      return assets.map((asset) => asset.name);
    },

    async uploadReleaseAsset(releaseId, name, bytes, label) {
      // Explicit content-length: uploads.github.com mishandles a missing/streamed
      // length on large assets (Pitfall 5). The Buffer is passed as data as-is
      // (Octokit accepts it); the ~2 GiB pre-upload guard lives in the engine (D-12).
      //
      // `label` (OBS-03) is a SEPARATE optional query param on
      // repos/upload-release-asset -- read from the installed Octokit types, not from
      // prose: the route is `...assets{?name,label}` and the schema declares
      // `query: { name: string; label?: string }`. Two consequences worth keeping,
      // because they are what make stamping it safe: it can influence neither the asset
      // filename nor the download URL (both are their own fields), and the 422
      // already-exists response is documented as keyed on FILENAME -- so a label can
      // never alter the first-write-wins arbitration the mirror depends on (D-05).
      await octokit.rest.repos.uploadReleaseAsset({
        owner,
        repo,
        release_id: releaseId,
        name,
        label,
        data: bytes as unknown as string,
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': String(bytes.byteLength),
        },
      });
    },
  };
}

/**
 * The sync-gated publish operation (TRUST-02/OBS-01, D-01/D-17). Mirrors this OS
 * leg's server-produced Actions-cache entries to the current month-shard GitHub
 * Release via the fully-tested publishMirror engine, then emits the D-17
 * "is-the-cache-working" summary. A whole-run fault propagates to the top-level
 * run().catch(setFailed) (fail loud, OBS-01/D-15); per-item faults are isolated and
 * annotated inside the engine (D-13), and a nonzero aggregate `failed` count fails
 * the run loud via the engine's core.setFailed (OBS-01/D-15), mirroring cleanupMirror.
 */
export async function runPublish(): Promise<void> {
  // D-01/TRUST-02: the sync gate is the FIRST statement of the publish path -- the
  // default-branch check lives in the predicate, not the workflow `if:` alone. A
  // gated-out run (a PR, a non-default ref, a tag) is a clean exit 0: core.info +
  // return, never an error. isSyncTrusted, NOT isWriteTrusted -- Phase 5 widens the
  // WRITE allowlist to pull_request/release and a shared predicate would silently
  // widen SYNC with it (the CREEP precondition C2 exists to prevent).
  const sync = isSyncTrusted(process.env);

  if (!sync.trusted) {
    core.info(
      `github-cache publish: not a trusted sync context (${sync.reason}); skipping (no mirror).`,
    );

    return;
  }

  const repository = process.env.GITHUB_REPOSITORY ?? '';

  if (!GITHUB_REPOSITORY_PATTERN.test(repository)) {
    // Fail-closed on a corrupted repository identity (selectBackend/cleanup
    // precedent): a trusted publish path must never resolve into another namespace.
    throw new Error(
      'github-cache publish: GITHUB_REPOSITORY must be a valid owner/name',
    );
  }

  const [owner, repo] = repository.split('/');
  const token = resolveGitHubToken(process.env);

  if (token === undefined) {
    // No token means the enumerate/upload path cannot authenticate; fail loud once
    // here rather than let every getActionsCacheList / upload 401 (OBS-01/D-15).
    throw new Error(
      'github-cache publish: no GH_TOKEN/GITHUB_TOKEN resolved for the upload path',
    );
  }

  const ref = process.env.GITHUB_REF ?? '';
  const octokit = createResilientOctokit(token);

  const result = await publishMirror(
    createPublishClient(octokit, owner, repo, ref),
  );

  // D-17 (OBS-01): the "is the cache working" signal -- the run counts as a
  // job-summary table, through the shared single-source renderer. `scanned` is the
  // denominator (mirrored + skipped + failed), and the restore-MISS row is a
  // BREAKDOWN of `skipped`, not an addend -- the engine's miss branch increments
  // both -- so the label says `(of skipped)`. That label is what stops the next
  // reader summing the column to more than `scanned`. writeCountSummary takes
  // [metric, number] pairs only, so the label is the only place this can be said;
  // the shared renderer is NOT widened to carry a note row for one caller.
  await writeCountSummary('github-cache publish', [
    ['scanned', result.scanned],
    ['mirrored', result.mirrored],
    ['skipped', result.skipped],
    ['restore-MISS (of skipped)', result.readMisses],
    ['failed', result.failed],
  ]);

  // VER-05: the compression method is a THIRD cache-version component, pushed into
  // the version unconditionally by @actions/cache's getCacheVersion
  // (cacheUtils.js:162-163) BEFORE and independent of the enableCrossOsArchive
  // branch at :166 -- so the flag plan 09-03 hardcoded cannot rescue a mismatch on
  // this axis. Reporting it is how a reader of a cross-OS MISS can tell which of the
  // three components moved.
  const compressionMethod = resolveCompressionMethod();

  core.info(
    `github-cache publish: @actions/cache resolved compression method ${compressionMethod}.`,
  );

  // Three things are load-bearing about the two lines below.
  //
  // 1. core.summary.write() APPENDS by default -- @actions/core/lib/summary.js:69-77
  //    picks appendFile unless options.overwrite is truthy -- and write() empties the
  //    buffer. So a SECOND write() after writeCountSummary's adds to the rendered
  //    summary rather than clobbering the table. The leading newline is what puts a
  //    blank line after the table's closing HTML so this line renders as markdown
  //    instead of being absorbed into the HTML block.
  // 2. writeCountSummary cannot carry this value. It takes [string, number] pairs and
  //    renders a column headed `count`, and `zstd-without-long` under a `count`
  //    header is wrong. summary.ts's own doc block already states the shared renderer
  //    is not widened for one caller, and the writeCountSummary call above repeats it
  //    -- cited rather than restated a third time.
  // 3. SURFACED, NEVER GATED. No branch anywhere reads this value; it reaches the log
  //    and the job summary and stops (T-09-31). If some future requirement wants to
  //    gate on it, that is a new decision and not an extension of this one.
  core.summary.addRaw(
    `\ncompression method (@actions/cache): ${compressionMethod}`,
    true,
  );
  await core.summary.write();
}

/**
 * Internal CI dogfood entry (D-05, ROADMAP SC5, ROBUST-03). Runs the real
 * `serve()` composition in its own foreground process, masks the bearer token,
 * drives ONE scripted cache operation, fails loudly on any unexpected status or
 * body, and drains on exit. This same entry is the `test:act` canary: off-CI it
 * self-skips (exit 0) because the Actions-cache runtime does not exist locally.
 */
export async function run(): Promise<void> {
  // ACTIONS_RUNTIME_TOKEN / ACTIONS_RESULTS_URL are injected ONLY into a JS-action
  // runtime, never into an ordinary shell step or a local shell. Outside that
  // runtime the cache primitive silently no-ops, so a green run would prove
  // nothing. This is the documented local no-op path for `test:act`: exit 0 with a
  // skip notice rather than fail. Checked BEFORE reading required inputs so the
  // local invocation never trips getInput's required-and-not-supplied throw.
  if (!process.env.ACTIONS_RUNTIME_TOKEN || !process.env.ACTIONS_RESULTS_URL) {
    core.info(
      'github-cache dogfood: SKIP -- ACTIONS_RUNTIME_TOKEN/ACTIONS_RESULTS_URL absent. ' +
        'The Actions-cache runtime exists only inside a JS action on real CI; the real ' +
        'canary is the dogfood-seed/dogfood-verify CI job pair on a push to the default branch.',
    );

    return;
  }

  // Read `operation` BEFORE the required `hash` input so the publish branch never
  // trips getInput's required-and-not-supplied throw (publish uses no hash).
  const operation = core.getInput('operation', { required: true });

  if (operation === 'publish') {
    await runPublish();

    return;
  }

  const hash = core.getInput('hash', { required: true });

  // serve() is the real composition root: it calls selectBackend(process.env),
  // which in a trusted push context returns the writable Actions-cache backend.
  // The runtime cache credentials reach this process ONLY by inheritance from the
  // action runtime and must never be re-exported through the workflow environment
  // file -- that hygiene rule (D-06) is the whole reason a JS action, not a plain
  // run: step, is the launch path. The bearer token minted below is a
  // THIRD, separate credential (a per-process CSPRNG secret guarding the local
  // server) and must not be conflated with the runtime token or the workflow token.
  const running = await serve();

  // Mask the bearer token BEFORE any code path can print it (T-2-19). serve()'s own
  // direct-invocation main() writes the token to stdout; this action never uses that
  // path, and setSecret runs here as the first statement after the server starts.
  core.setSecret(running.token);

  const authorization = `Bearer ${running.token}`;
  const url = `${running.url}/v1/cache/${hash}`;

  // The dogfoodBody call is deliberately NOT here. It lives INSIDE each branch below,
  // one per leg, because the two legs pass DIFFERENT producer-OS arguments and those
  // arguments must stay physically apart (C-01, T-09-37). Computing a conditional
  // `producerOs` above the branch -- or hoisting a shared `body` back to this line --
  // reintroduces the one-expression coupling that makes VER-06's vacuity trap
  // reachable, and it hides the asymmetry at the point where it matters. Do not
  // "simplify" the two calls back together.
  try {
    // `operation` selects ONLY which HTTP verb this dogfood drives. It has no
    // influence whatsoever on read-versus-write capability -- that is derived from
    // runtime context inside selectBackend, and no action input may ever steer it
    // (TRUST-05). Every branch below either asserts an exact expected status/body or
    // fails the job explicitly: a silent pass on a miss is precisely the failure mode
    // this dogfood exists to catch (T-2-20).
    if (operation === 'seed') {
      // cachePlatform() -- an ambient read, legitimate here because this is a bin and
      // LINT-02's ban on deriving an expectation from the running machine is scoped to
      // spec files (eslint.config.mjs:263). The seed leg is the PRODUCER, so its own
      // platform IS the correct provenance stamp.
      const body = dogfoodBody(hash, cachePlatform());

      const put = await fetch(url, {
        method: 'PUT',
        headers: { authorization },
        body,
      });

      if (put.status !== 200) {
        core.setFailed(
          `github-cache dogfood seed: expected PUT 200, got ${put.status}.`,
        );

        return;
      }

      core.info(`github-cache dogfood seed: stored ${hash} (PUT 200).`);

      return;
    }

    if (operation === 'mirror-seed') {
      // A THIRD SIBLING of the two branches around it, never a variant of `seed`:
      // dogfood-seed/dogfood-verify REQUIRE one shared key per RUN, and seeding that
      // key per OS is exactly the vacuity trap VER-06 closed (D-13). This operation
      // seeds the OPPOSITE thing -- a key only THIS publish leg can produce (OBS-05).
      //
      // THE URL IS BUILT LOCALLY, AND THAT IS THE WHOLE GUARD. The `url` binding above
      // these branches is composed from the RAW `hash` input, so reusing it here would
      // PUT at nx-cache-<run_id> while read-back.ts looks under nx-cache-<derived
      // seed>. The PUT would still return 200, so nothing would fail on this side and
      // the break would surface only as a publish-verify MISS. Nothing is hoisted above
      // the branches either -- see the no-hoist lock above, which exists for the same
      // class of coupling. action/index.spec.ts asserts the requested PATH rather than a
      // substring, because the derived seed CONTAINS the run id.
      //
      // cachePlatform() -- an ambient read, legitimate here for the same reason the
      // seed branch's is: this is a bin, LINT-02's ban on deriving an expectation from
      // the running machine is scoped to spec files, and THIS leg is the producer, so
      // its own platform IS the correct provenance stamp. The local is inside the
      // branch, which is what the lock above requires; it is the conditional-above-the-
      // branch shape that is banned, not a branch-local binding.
      //
      // `operation` still selects only a verb and now a key derivation with it. It
      // cannot influence read-versus-write capability -- that is derived from runtime
      // context inside selectBackend and no action input may steer it (TRUST-05).
      const producerOs = cachePlatform();
      const seedHash = mirrorSeedHash(hash, producerOs);
      const seedUrl = `${running.url}/v1/cache/${seedHash}`;
      const body = dogfoodBody(seedHash, producerOs);

      const put = await fetch(seedUrl, {
        method: 'PUT',
        headers: { authorization },
        body,
      });

      if (put.status !== 200) {
        core.setFailed(
          `github-cache mirror-seed: expected PUT 200, got ${put.status}.`,
        );

        return;
      }

      core.info(
        `github-cache mirror-seed: stored ${seedHash} for this ${producerOs} publish leg (PUT 200).`,
      );

      return;
    }

    if (operation === 'verify') {
      // THE LITERAL 'linux', and the VACUITY CONDITION it encodes (D-19, D-20, D-21).
      //
      // dogfood-seed is ubuntu-ONLY BY DESIGN, so the expected producer is Linux, and
      // asserting that literal is what makes this job a PROVENANCE check rather than a
      // presence check: on the windows-11-arm matrix leg, matching these bytes proves
      // the restored body was produced on LINUX and crossed an OS boundary. On the
      // ubuntu leg the same claim is trivially true, and the leg is kept anyway because
      // it preserves the v0.0.1 same-OS round-trip close.
      //
      // IF A WINDOWS dogfood-seed LEG IS EVER ADDED, THIS LITERAL IS WHAT MUST CHANGE.
      // Until it does, the assertion silently weakens to "the body came from whichever
      // OS seeded it" -- which is what a presence-only check already gives for free,
      // with cross-OS restore possibly completely dead. The seed key is
      // nx-cache-<GITHUB_RUN_ID>: ONE key per RUN, not per OS. dogfood-cross-os.spec.ts
      // asserts dogfood-seed declares no matrix so this cannot happen unnoticed.
      //
      // NO ACTION INPUT carries this value on purpose: an input would be a SECOND place
      // for the two legs to disagree, and the seed leg's OS is a property of the
      // workflow rather than of the run. Nothing about `operation` or any other input
      // may steer read-versus-write capability either (TRUST-05).
      const expectedProducerOs = 'linux';
      const body = dogfoodBody(hash, expectedProducerOs);

      const get = await fetch(url, { headers: { authorization } });

      if (get.status === 404) {
        core.setFailed(
          `github-cache dogfood verify: cache MISS for ${hash} (GET 404). The round-trip ` +
            "did not reach GitHub's cache service -- suspect the cacheArchivePath archive-path " +
            'derivation or a pinned @actions/cache upgrade that changed the archive version hash. ' +
            `This runner is ${cachePlatform()} and the seed leg is ${expectedProducerOs}: on a ` +
            'NON-LINUX runner a MISS additionally suggests the archive VERSION still differs ' +
            'across OSes -- the enableCrossOsArchive flag or the archive path literal -- rather ' +
            'than cross-OS extraction itself failing. Those are different repairs.',
        );

        return;
      }

      if (get.status !== 200) {
        core.setFailed(
          `github-cache dogfood verify: expected GET 200, got ${get.status}.`,
        );

        return;
      }

      const received = Buffer.from(await get.arrayBuffer());

      if (!received.equals(body)) {
        // Names the EXPECTED producer OS so a mismatch reads as a PROVENANCE failure
        // rather than as generic corruption. The received buffer is deliberately NOT
        // interpolated: it is restored cache content and this log is public. Phase 8's
        // WR-01 lesson is that a log line used as a signal must be both escaped and
        // anchored; naming our own expectation is sufficient here, so the restored
        // bytes never reach the log at all (T-09-38).
        core.setFailed(
          'github-cache dogfood verify: cache HIT but the returned bytes did not match ' +
            `the payload seeded by a '${expectedProducerOs}' producer -- the round-trip crossed ` +
            'the cache service but returned a body this leg cannot attribute to the seed job.',
        );

        return;
      }

      core.info(
        `github-cache dogfood verify: cache HIT for ${hash} on ${cachePlatform()} with bytes ` +
          `matching a '${expectedProducerOs}'-produced payload.`,
      );

      return;
    }

    core.setFailed(
      `github-cache dogfood: unknown operation '${operation}' (expected 'seed', 'mirror-seed' or 'verify').`,
    );
  } finally {
    // Drain and close on EVERY path -- success and failure alike -- so the process
    // exits cleanly and the bounded SIGTERM drain seam (ROBUST-04) is exercised in
    // production, not only in the unit specs.
    await running.shutdown();
  }
}

// Direct-invocation guard: run() only when this module is the entrypoint (the built
// dist/action/index.js invoked by this repo's dogfood action.yml), never when
// runPublish/createPublishClient/run are imported for unit tests (I5: the old
// unconditional run() left the sync-gate-first ordering, the keyless-row filter, and
// the dogfood fail-loud branches untestable-by-import). isEntrypoint owns the Windows
// Pitfall-6 idiom, shared with the cleanup + read-back bins.
if (isEntrypoint(import.meta.url)) {
  run().catch((error: unknown) => {
    core.setFailed(error instanceof Error ? error.message : String(error));
  });
}
