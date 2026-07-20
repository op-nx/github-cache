// Consumer sidecar action entry (Channel B). Thin glue over the already-tested
// serve() composition root -- it is transpiled + bundled into index.js by
// esbuild, NOT nx-typechecked (it lives outside the github-cache tsconfig), so
// it is kept minimal. ponytail: tiny glue, low risk -- the real logic is serve().
//
// It deep-imports serve() from the package source (serve stays OUT of the
// consumer barrel per D-04; our own bundle entry may import our internal module).
import * as core from '@actions/core';
import { serve } from '../packages/github-cache/src/serve.js';

async function run(): Promise<void> {
  const port = core.getInput('port') || undefined;
  const running = await serve({ port });

  // Mask the CSPRNG bearer token BEFORE any subsequent log path can print it,
  // then export the two Nx client vars so a later `npx nx` step in the same job
  // points the Nx cache client at this loopback sidecar (research A5). The
  // listening server keeps the process alive under `background: true` (A4), so
  // no manual keep-alive is needed; the `cancel:` teardown drives serve()'s
  // SIGTERM drain (ROBUST-04).
  core.setSecret(running.token);
  core.exportVariable('NX_SELF_HOSTED_REMOTE_CACHE_SERVER', running.url);
  core.exportVariable(
    'NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN',
    running.token,
  );
}

void run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
