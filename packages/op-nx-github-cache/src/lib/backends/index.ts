import type { CacheBackend } from '../types.js';
import { resolveMaxAgeDays } from '../shard.js';
import { createActionsCacheBackend } from './actions-cache-backend.js';
import { createReleaseMirrorBackend } from './release-mirror-backend.js';

// Backend mode is derived entirely from the runtime context (GITHUB_ACTIONS),
// never a manual flag -- there is no "read-only mode" setting a caller can
// get wrong.
export function selectBackend(env: NodeJS.ProcessEnv): CacheBackend {
  if (env.GITHUB_ACTIONS === 'true') {
    return createActionsCacheBackend();
  }

  const repository = env.GITHUB_REPOSITORY;

  if (!repository) {
    throw new Error(
      'GITHUB_REPOSITORY (format "owner/repo") must be set to use the local read-only release-asset mirror.',
    );
  }

  const [owner, repo] = repository.split('/');

  // Reject a malformed value up front: without both halves octokit would hit
  // `/repos/<owner>/undefined/...` and surface a confusing false-404/500 with
  // no hint the env var is the problem.
  if (!owner || !repo) {
    throw new Error(
      `GITHUB_REPOSITORY must be "owner/repo"; got "${repository}".`,
    );
  }

  // Same env var publish-mirror.ts's cleanup reads -- keeps the read
  // lookback and the cleanup/retention window coupled to one setting.
  const maxAgeDays = resolveMaxAgeDays(env.CACHE_MIRROR_MAX_AGE_DAYS);
  // Optional: an anonymous client is capped at 60 req/hr, which a real
  // `nx affected` blows through; a token lifts it to 5000/hr. Anonymous stays
  // the zero-config default for public-repo reads when neither is set.
  const auth = env.GH_TOKEN ?? env.GITHUB_TOKEN;

  return createReleaseMirrorBackend({ owner, repo, maxAgeDays, auth });
}
