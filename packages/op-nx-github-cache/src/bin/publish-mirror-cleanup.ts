#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { monthTag } from '../lib/shard.js';
import { cleanupMirror, resolveTrustedRepo } from './publish-mirror.js';

// Cleanup runs as its own daily scheduled workflow (mirror-cleanup.yml), NOT as
// part of the per-OS publish-mirror matrix. That makes it a single writer by
// construction -- no env-var gate, no concurrent-cleanup races -- and lets
// retention (a rolling per-asset age, CACHE_MIRROR_MAX_AGE_DAYS) be enforced on
// a calendar cadence independent of pushes: a push-triggered prune would never
// fire while the repo is idle, leaving expired assets serving hits past their
// TTL and hoarding the 1000-asset-per-release cap.
async function main(): Promise<void> {
  const { repo } = await resolveTrustedRepo();
  const cleanupFailures = await cleanupMirror(repo, monthTag(new Date()));

  if (cleanupFailures.length > 0) {
    throw new Error(
      `${cleanupFailures.length} shard(s) failed to clean up: ${cleanupFailures.join(', ')}`,
    );
  }
}

// Only run as a CLI entry point, not when imported.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
