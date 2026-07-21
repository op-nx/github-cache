import { pathToFileURL } from 'node:url';
import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import { serve } from '../serve.js';
import { isSyncTrusted } from '../lib/sync-gate.js';
import {
  GITHUB_REPOSITORY_PATTERN,
  resolveGitHubToken,
} from '../lib/select-backend.js';
import {
  publishMirror,
  type PublishClient,
} from '../publish/publish-mirror.js';

/**
 * Deterministic dogfood payload for a given cache hash. The seed job PUTs it and
 * the verify job GETs it and asserts an exact byte match, so both jobs agree on
 * the expected bytes without passing anything between them -- the only shared
 * input is the workflow run id used as the hash.
 */
function dogfoodBody(hash: string): Buffer {
  return Buffer.from(`nx-github-cache-dogfood:${hash}`);
}

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

    async uploadReleaseAsset(releaseId, name, bytes) {
      // Explicit content-length: uploads.github.com mishandles a missing/streamed
      // length on large assets (Pitfall 5). The Buffer is passed as data as-is
      // (Octokit accepts it); the ~2 GiB pre-upload guard lives in the engine (D-12).
      await octokit.rest.repos.uploadReleaseAsset({
        owner,
        repo,
        release_id: releaseId,
        name,
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
  if (!isSyncTrusted(process.env)) {
    core.info(
      'github-cache publish: not a trusted sync context; skipping (no mirror).',
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
  const octokit = new Octokit({ auth: token });

  const result = await publishMirror(
    createPublishClient(octokit, owner, repo, ref),
  );

  // D-17 (OBS-01): the "is the cache working" signal -- a job-summary table of the
  // mirrored/skipped/failed counts the engine returns. Mirrors the cleanup summary.
  core.summary.addHeading('github-cache publish', 2).addTable([
    [
      { data: 'metric', header: true },
      { data: 'count', header: true },
    ],
    ['mirrored', String(result.mirrored)],
    ['skipped', String(result.skipped)],
    ['failed', String(result.failed)],
  ]);
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
  const body = dogfoodBody(hash);

  try {
    // `operation` selects ONLY which HTTP verb this dogfood drives. It has no
    // influence whatsoever on read-versus-write capability -- that is derived from
    // runtime context inside selectBackend, and no action input may ever steer it
    // (TRUST-05). Every branch below either asserts an exact expected status/body or
    // fails the job explicitly: a silent pass on a miss is precisely the failure mode
    // this dogfood exists to catch (T-2-20).
    if (operation === 'seed') {
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

    if (operation === 'verify') {
      const get = await fetch(url, { headers: { authorization } });

      if (get.status === 404) {
        core.setFailed(
          `github-cache dogfood verify: cache MISS for ${hash} (GET 404). The round-trip ` +
            "did not reach GitHub's cache service -- suspect the cacheArchivePath archive-path " +
            'derivation or a pinned @actions/cache upgrade that changed the archive version hash.',
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
        core.setFailed(
          'github-cache dogfood verify: cache HIT but the returned bytes did not match ' +
            'the seeded payload -- the round-trip crossed the cache service but returned wrong data.',
        );

        return;
      }

      core.info(
        `github-cache dogfood verify: cache HIT for ${hash} with matching bytes.`,
      );

      return;
    }

    core.setFailed(
      `github-cache dogfood: unknown operation '${operation}' (expected 'seed' or 'verify').`,
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
// the dogfood fail-loud branches untestable-by-import). Use
// pathToFileURL(process.argv[1]).href -- the naive 'file://' + argv[1] form is
// permanently false on Windows (Pitfall 6), matching the cleanup + read-back bins.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run().catch((error: unknown) => {
    core.setFailed(error instanceof Error ? error.message : String(error));
  });
}
