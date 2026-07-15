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
  // Same env var publish-mirror.ts's cleanup reads -- keeps the read
  // lookback and the cleanup/retention window coupled to one setting.
  const maxAgeDays = resolveMaxAgeDays(env.CACHE_MIRROR_MAX_AGE_DAYS);

  return createReleaseMirrorBackend({ owner, repo, maxAgeDays });
}
