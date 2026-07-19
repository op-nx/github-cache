import * as core from '@actions/core';
import { serve } from '../serve.js';

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
 * Internal CI dogfood entry (D-05, ROADMAP SC5, ROBUST-03). Runs the real
 * `serve()` composition in its own foreground process, masks the bearer token,
 * drives ONE scripted cache operation, fails loudly on any unexpected status or
 * body, and drains on exit. This same entry is the `test:act` canary: off-CI it
 * self-skips (exit 0) because the Actions-cache runtime does not exist locally.
 */
async function run(): Promise<void> {
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

  const hash = core.getInput('hash', { required: true });
  const operation = core.getInput('operation', { required: true });

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

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
