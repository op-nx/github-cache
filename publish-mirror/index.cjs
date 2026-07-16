'use strict';

const { spawnSync } = require('node:child_process');

function fail(message) {
  // ::error:: annotation + exit 1: a mirror that can't work must fail loudly,
  // never publish an empty shard that looks like it succeeded.
  console.log(`::error::@op-nx/github-cache: ${message}`);
  process.exit(1);
}

const command =
  process.env.INPUT_COMMAND || 'npx op-nx-github-cache-publish-mirror';
const token =
  process.env.INPUT_TOKEN ||
  process.env.GH_TOKEN ||
  process.env.GITHUB_TOKEN ||
  '';

// GUARD (token). gh needs it to list the Actions caches (actions:read) and to
// upload/prune Release assets (contents:write).
if (!token) {
  fail(
    'no token for publish-mirror; set the `token` input or GITHUB_TOKEN (the job needs actions:read + contents:write).',
  );
}

// GUARD (runtime env). publish-mirror downloads each cache entry with
// @actions/cache's restoreCache, which needs ACTIONS_RUNTIME_TOKEN /
// ACTIONS_RESULTS_URL -- injected only into JavaScript actions (this one),
// never run: steps, and unreachable via gh/Octokit (no REST cache-content
// download exists). Without it every restore silently no-ops and the shard is
// published EMPTY; make that a loud failure instead.
const hasRuntimeToken = Boolean(process.env.ACTIONS_RUNTIME_TOKEN);
const hasCacheUrl = Boolean(
  process.env.ACTIONS_RESULTS_URL || process.env.ACTIONS_CACHE_URL,
);

if (!hasRuntimeToken || !hasCacheUrl) {
  const missing = [
    !hasRuntimeToken && 'ACTIONS_RUNTIME_TOKEN',
    !hasCacheUrl && 'ACTIONS_RESULTS_URL / ACTIONS_CACHE_URL',
  ]
    .filter(Boolean)
    .join(', ');

  fail(
    `missing Actions cache runtime env (${missing}); restoreCache cannot read cache content, so the mirror would be empty. This env exists only in JavaScript actions.`,
  );
}

// Short-lived, unlike the cache server: run it synchronously and mirror its exit
// status. gh reads GH_TOKEN; the runtime env checked above is inherited via env.
const result = spawnSync(command, {
  shell: true,
  stdio: 'inherit',
  env: { ...process.env, GH_TOKEN: token },
});

if (result.error) {
  fail(`failed to run publish-mirror: ${result.error.message}`);
}

process.exit(result.status == null ? 1 : result.status);
