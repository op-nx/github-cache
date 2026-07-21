// Consumer sidecar action entry (Channel B). Thin glue over the already-tested
// serve() composition root -- it is transpiled + bundled into index.js by
// esbuild, NOT nx-typechecked (it lives outside the github-cache tsconfig), so
// it is kept minimal. ponytail: tiny glue, low risk -- the real logic is serve().
//
// It deep-imports serve() from the package source (serve stays OUT of the
// consumer barrel per D-04; our own bundle entry may import our internal module).
//
// HANDSHAKE (consumer-pre-sets / action-adopts, DOCS-06 live-CI fix): a
// background step CANNOT export env to later steps. core.exportVariable writes
// $GITHUB_ENV, which the runner only processes AFTER a step COMPLETES -- and a
// background step does not "complete" until its `cancel:` teardown, so its
// exportVariable calls never reach a later Nx step. Therefore the CONSUMER sets
// NX_SELF_HOSTED_REMOTE_CACHE_SERVER and NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN
// (plus a fixed port) in a REGULAR step BEFORE this background step; serve()
// ADOPTS the pre-set token (env) and port (input), so this action generates and
// exports nothing -- it fails fast if the token is missing.
import * as core from '@actions/core';
import { serve } from '../packages/github-cache/src/serve.js';

async function run(): Promise<void> {
  // Fail fast BEFORE binding: without a pre-set token serve() would mint a fresh
  // CSPRNG one that the Nx client never sees, so every read would 401/MISS. A
  // background step cannot export env, so the consumer MUST set both NX_* vars in
  // a prior regular step.
  if (!process.env.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN) {
    core.setFailed(
      'NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN is not set. A background step ' +
        'cannot export env to later steps, so set both ' +
        'NX_SELF_HOSTED_REMOTE_CACHE_SERVER and ' +
        'NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN (with a matching fixed port) ' +
        'in a regular step BEFORE this background step -- this action adopts them.',
    );

    return;
  }

  const port = core.getInput('port') || undefined;
  const running = await serve({ port });

  // Mask the adopted bearer token in this action's own logs, then log the
  // listening url (never the token). serve() already adopted the pre-set token +
  // port from env/input, so the consumer's later Nx step points at this loopback
  // sidecar. The listening server keeps the process alive under `background: true`;
  // the `cancel:` teardown drives serve()'s SIGTERM drain (ROBUST-04).
  core.setSecret(running.token);
  core.info(`github-cache sidecar listening on ${running.url}`);
}

void run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
