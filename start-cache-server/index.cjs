'use strict';

const { spawn } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');

// Mirrors packages/op-nx-github-cache/src/lib/trust.ts (TRUSTED_EVENTS) -- keep
// in sync. These are GitHub's write-scoped trigger events. On anything else the
// cache service issues a read-only token, so there is no point starting the
// server or handing it the runtime token.
const TRUSTED_EVENTS = new Set([
  'push',
  'schedule',
  'workflow_dispatch',
  'repository_dispatch',
  'delete',
  'registry_package',
  'page_build',
  'merge_group',
]);

const READY_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 200;

function fail(message) {
  // ::error:: renders as a workflow annotation; paired with exit 1 it fails the
  // step. That is the point of this action's guards: a broken cache must be
  // LOUD, never a silent no-op (the original bug it was written to prevent).
  console.log(`::error::@op-nx/github-cache: ${message}`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const env = process.env;
  const eventName = env.GITHUB_EVENT_NAME;

  if (env.GITHUB_ACTIONS !== 'true' || !TRUSTED_EVENTS.has(eventName)) {
    // Untrusted (pull_request, ...) or off-Actions: writes are refused
    // server-side and by isWriteTrusted() regardless, so skip entirely. No
    // server process, no runtime token handed out; builds just run locally.
    console.log(
      `@op-nx/github-cache: '${eventName ?? 'unknown'}' is not a trusted write event; skipping cache server.`,
    );

    return;
  }

  // GUARD (runtime env). A JavaScript action is the ONLY step type GitHub
  // injects these into -- never `run:` shell steps. This action exists to hand
  // them to the server by inheritance, so if they are absent HERE the premise is
  // broken and every save/restore would silently no-op. Fail loudly instead.
  const hasToken = Boolean(env.ACTIONS_RUNTIME_TOKEN);
  const hasUrl = Boolean(env.ACTIONS_RESULTS_URL || env.ACTIONS_CACHE_URL);

  if (!hasToken || !hasUrl) {
    const missing = [
      !hasToken && 'ACTIONS_RUNTIME_TOKEN',
      !hasUrl && 'ACTIONS_RESULTS_URL / ACTIONS_CACHE_URL',
    ]
      .filter(Boolean)
      .join(', ');

    fail(
      `missing Actions cache runtime env (${missing}) on a trusted '${eventName}' event. ` +
        `These are injected only into JavaScript actions; the remote cache cannot work without them.`,
    );
  }

  const githubEnv = env.GITHUB_ENV;

  if (!githubEnv) {
    fail(
      'GITHUB_ENV is not set; cannot hand the server URL/token to later steps.',
    );
  }

  const command = env.INPUT_COMMAND || 'npx op-nx-github-cache-serve';

  // Detached so the server outlives this action -- later steps read its
  // NX_SELF_HOSTED_REMOTE_CACHE_* vars from $GITHUB_ENV. stdout is INHERITED,
  // never redirected: serve prints `::add-mask::<token>` at startup and that
  // must reach the runner's command processor to mask its bearer token;
  // redirecting stdout to a file would leak the token unmasked into later steps.
  // The child inherits `env` -- including ACTIONS_RUNTIME_TOKEN -- directly, so
  // the token never touches $GITHUB_ENV (where every later step would see it).
  const child = spawn(command, {
    shell: true,
    detached: true,
    stdio: ['ignore', 'inherit', 'inherit'],
    env,
  });

  child.unref();

  // serve appends NX_SELF_HOSTED_REMOTE_CACHE_SERVER once listening. Poll for it
  // (the documented run-step handshake). If it never lands the server failed to
  // start -- fail rather than let later steps run against an absent cache.
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (existsSync(githubEnv)) {
      const contents = readFileSync(githubEnv, 'utf8');

      if (contents.includes('NX_SELF_HOSTED_REMOTE_CACHE_SERVER')) {
        console.log('@op-nx/github-cache: cache server is ready.');

        return;
      }
    }

    await sleep(POLL_INTERVAL_MS);
  }

  fail(
    `cache server did not become ready within ${READY_TIMEOUT_MS / 1000}s ` +
      `(no NX_SELF_HOSTED_REMOTE_CACHE_SERVER in $GITHUB_ENV); it likely failed to start.`,
  );
}

main().catch((error) => {
  console.log(
    `::error::@op-nx/github-cache: ${error && error.stack ? error.stack : error}`,
  );
  process.exit(1);
});
